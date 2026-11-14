import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contactSchema, sendMessageSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { Conversation } from "../models/Conversation.js";
import { ContactMessage } from "../models/ContactMessage.js";
import { Message } from "../models/Message.js";
import { MusicTrack } from "../models/MusicTrack.js";
import { User } from "../models/User.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const oid = () => new mongoose.Types.ObjectId();
const ME = oid().toString();
const OTHER = oid();
const auth = { Authorization: `Bearer ${signAccessToken(ME)}` };

afterEach(() => vi.restoreAllMocks());

const leanOf = (value: unknown) => ({ lean: () => Promise.resolve(value) });
const findOne = (user: unknown) =>
  vi
    .spyOn(User, "findOne")
    .mockImplementation((() => ({ collation: () => leanOf(user) })) as never);

describe("schemas", () => {
  it("validates music-only, mixed, limits and case-insensitive duplicates", () => {
    const ids = Array.from({ length: 11 }, () => oid().toString());
    expect(sendMessageSchema.parse({ musicTrackIds: ids.slice(0, 1) }).text).toBe("");
    expect(sendMessageSchema.safeParse({ text: "hello", musicTrackIds: ids.slice(0, 10) }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ musicTrackIds: ids }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ musicTrackIds: [ids[0], ids[0]!.toUpperCase()] }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ musicTrackIds: ["invalid"] }).success).toBe(false);
  });
  it("trim and bound message text", () => {
    expect(sendMessageSchema.parse({ text: "  hi  " }).text).toBe("hi");
    expect(sendMessageSchema.safeParse({ text: "   " }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ text: "x".repeat(1001) }).success).toBe(false);
  });
  it("contact form needs a real email and message", () => {
    const ok = { name: "Sam", email: "SAM@Example.com", message: "Hello there, friend" };
    expect(contactSchema.parse(ok).email).toBe("sam@example.com");
    expect(contactSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, message: "short" }).success).toBe(false);
  });
});

describe("message routes", () => {
  it("rejects missing music before creating a conversation", async () => {
    findOne({ _id: OTHER, username: "sam", banned: false });
    vi.spyOn(MusicTrack, "countDocuments").mockResolvedValue(0 as never);
    const upsert = vi.spyOn(Conversation, "findOneAndUpdate");
    const create = vi.spyOn(Message, "create");
    const res = await request(app).post("/api/messages/with/sam").set(auth).send({ musicTrackIds: [oid().toString()] });
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("sends music-only messages and uses a music preview", async () => {
    findOne({ _id: OTHER, username: "sam", banned: false });
    const convoId = oid();
    const trackId = oid();
    vi.spyOn(MusicTrack, "countDocuments").mockResolvedValue(1 as never);
    vi.spyOn(MusicTrack, "find").mockImplementation((() => ({ select: () => leanOf([{ _id: trackId, title: "Song", artist: "Artist", duration: 20 }]) })) as never);
    vi.spyOn(Conversation, "findOneAndUpdate").mockImplementation((() => leanOf({ _id: convoId })) as never);
    vi.spyOn(Message, "create").mockImplementation((async (data: unknown) => ({ ...(data as object), _id: oid(), createdAt: new Date(), toObject() { return this; } })) as never);
    const update = vi.spyOn(Conversation, "updateOne").mockResolvedValue({} as never);
    const res = await request(app).post("/api/messages/with/sam").set(auth).send({ musicTrackIds: [trackId.toString()] });
    expect(res.status).toBe(201);
    expect(res.body.message.text).toBe("");
    expect(res.body.message.musicAttachments).toEqual([{ id: trackId.toString(), title: "Song", artist: "Artist", duration: 20, unavailable: false }]);
    expect((update.mock.calls[0] as unknown as [unknown, unknown])[1]).toMatchObject({ $set: { lastMessageText: "Музыка" } });
  });

  it("sends mixed content in an existing conversation and retains the client identifier", async () => {
    const convoId = oid();
    const trackId = oid();
    const clientMessageId = "a1a1a1a1-1111-4111-8111-111111111111";
    vi.spyOn(Conversation, "findById").mockImplementation((() => leanOf({ _id: convoId, participants: [ME, OTHER], lastMessageAt: new Date() })) as never);
    vi.spyOn(User, "findById").mockImplementation((() => ({ select: () => leanOf({ banned: false }) })) as never);
    vi.spyOn(MusicTrack, "countDocuments").mockResolvedValue(1 as never);
    vi.spyOn(MusicTrack, "find").mockImplementation((() => ({ select: () => leanOf([{ _id: trackId, title: "Song", artist: "Artist" }]) })) as never);
    vi.spyOn(Message, "create").mockImplementation((async (data: unknown) => ({ ...(data as object), _id: oid(), createdAt: new Date(), toObject() { return this; } })) as never);
    const update = vi.spyOn(Conversation, "updateOne").mockResolvedValue({} as never);
    const res = await request(app).post(`/api/messages/${convoId}`).set(auth).send({ text: "hello", musicTrackIds: [trackId.toString()], clientMessageId });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ text: "hello", clientMessageId, musicAttachments: [{ id: trackId.toString() }] });
    expect((update.mock.calls[0] as unknown as [unknown, unknown])[1]).toMatchObject({ $set: { lastMessageText: "hello" } });
  });

  it("loads music once for a history page and preserves order and missing tracks", async () => {
    const convoId = oid();
    const first = oid();
    const missing = oid();
    vi.spyOn(Conversation, "findById").mockImplementation((() => leanOf({ _id: convoId, participants: [ME, OTHER], lastMessageAt: new Date() })) as never);
    const rows = [
      { _id: oid(), conversation: convoId, sender: OTHER, text: "", musicTrackIds: [missing, first], createdAt: new Date() },
      { _id: oid(), conversation: convoId, sender: OTHER, text: "old", createdAt: new Date() },
    ];
    vi.spyOn(Message, "find").mockImplementation((() => ({ sort: () => ({ limit: () => leanOf(rows) }) })) as never);
    const find = vi.spyOn(MusicTrack, "find").mockImplementation((() => ({ select: () => leanOf([{ _id: first, title: "Song", artist: "Artist" }]) })) as never);
    const res = await request(app).get(`/api/messages/${convoId}?cursor=2026-01-01T00:00:00.000Z`).set(auth);
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledOnce();
    expect(res.body.items[0].musicAttachments).toEqual([]);
    expect(res.body.items[1].musicAttachments).toEqual([{ id: missing.toString(), unavailable: true }, { id: first.toString(), title: "Song", artist: "Artist", duration: null, unavailable: false }]);
  });
  it("require a login", async () => {
    expect((await request(app).get("/api/messages")).status).toBe(401);
    expect((await request(app).get("/api/messages/unread-count")).status).toBe(401);
    expect((await request(app).post("/api/messages/with/sam").send({ text: "hi" })).status).toBe(
      401,
    );
  });

  it("reject empty messages before touching the database", async () => {
    const res = await request(app).post("/api/messages/with/sam").set(auth).send({ text: " " });
    expect(res.status).toBe(400);
  });

  it("refuse to message yourself", async () => {
    findOne({ _id: new mongoose.Types.ObjectId(ME), username: "myself", banned: false });
    const res = await request(app).post("/api/messages/with/myself").set(auth).send({ text: "hi" });
    expect(res.status).toBe(400);
  });

  it("refuse to message a suspended account", async () => {
    findOne({ _id: OTHER, username: "sam", banned: true });
    const res = await request(app).post("/api/messages/with/sam").set(auth).send({ text: "hi" });
    expect(res.status).toBe(403);
  });

  it("start a conversation with a stable pair key and count the unread for the recipient", async () => {
    findOne({ _id: OTHER, username: "sam", banned: false });
    const convoId = oid();
    const upsert = vi
      .spyOn(Conversation, "findOneAndUpdate")
      .mockImplementation((() =>
        leanOf({ _id: convoId, participants: [ME, OTHER], lastMessageAt: new Date() })) as never);
    vi.spyOn(Message, "create").mockResolvedValue({
      _id: oid(),
      conversation: convoId,
      sender: ME,
      text: "hello",
      createdAt: new Date(),
      toObject() {
        return this;
      },
    } as never);
    const update = vi.spyOn(Conversation, "updateOne").mockResolvedValue({} as never);

    const res = await request(app).post("/api/messages/with/sam").set(auth).send({ text: "hello" });
    expect(res.status).toBe(201);
    expect(res.body.conversationId).toBe(convoId.toString());
    expect(res.body.message.text).toBe("hello");

    const key = (upsert.mock.calls[0] as unknown as [{ key: string }])[0].key;
    expect(key).toBe([ME, OTHER.toString()].sort().join(":"));
    const change = (
      update.mock.calls[0] as unknown as [unknown, { $inc: Record<string, number> }]
    )[1];
    expect(change.$inc).toEqual({ [`unread.${OTHER.toString()}`]: 1 });
  });

  it("hide other people's conversations (404, not 403)", async () => {
    vi.spyOn(Conversation, "findById").mockImplementation((() =>
      leanOf({ _id: oid(), participants: [oid(), oid()], lastMessageAt: new Date() })) as never);
    const id = oid().toString();
    expect((await request(app).get(`/api/messages/${id}`).set(auth)).status).toBe(404);
    expect(
      (await request(app).post(`/api/messages/${id}`).set(auth).send({ text: "hi" })).status,
    ).toBe(404);
  });

  it("404 on malformed conversation ids", async () => {
    expect((await request(app).get("/api/messages/not-an-id").set(auth)).status).toBe(404);
  });

  it("list messages oldest first, with a cursor when there are more", async () => {
    const convoId = oid();
    vi.spyOn(Conversation, "findById").mockImplementation((() =>
      leanOf({
        _id: convoId,
        participants: [ME, OTHER],
        lastMessageAt: new Date(),
        unread: { [ME]: 2 },
      })) as never);
    const base = Date.parse("2026-10-26T10:00:00Z");
    const rows = [3, 2, 1].map((i) => ({
      _id: oid(),
      conversation: convoId,
      sender: OTHER,
      text: `m${i}`,
      createdAt: new Date(base + i * 1000),
    }));
    vi.spyOn(Message, "find").mockImplementation((() => ({
      sort: () => ({ limit: () => leanOf(rows) }),
    })) as never);
    const update = vi.spyOn(Conversation, "updateOne").mockResolvedValue({} as never);

    const res = await request(app).get(`/api/messages/${convoId}?limit=2`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.items.map((m: { text: string }) => m.text)).toEqual(["m2", "m3"]);
    expect(res.body.nextCursor).toBe(new Date(base + 2000).toISOString());
    // reading the latest page clears the unread counter
    expect(update).toHaveBeenCalledWith(
      { _id: convoId.toString() },
      { $set: { [`unread.${ME}`]: 0 } },
    );
  });
});

describe("POST /api/contact", () => {
  const body = { name: "Sam", email: "sam@example.com", message: "I love this site, thanks" };

  it("saves a valid message", async () => {
    const create = vi.spyOn(ContactMessage, "create").mockResolvedValue({} as never);
    const res = await request(app).post("/api/contact").send(body);
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledOnce();
  });

  it("silently ignores bots that fill the honeypot", async () => {
    const create = vi.spyOn(ContactMessage, "create").mockResolvedValue({} as never);
    const res = await request(app)
      .post("/api/contact")
      .send({ ...body, website: "http://spam.example" });
    expect(res.status).toBe(201);
    expect(create).not.toHaveBeenCalled();
  });

  it("validates input", async () => {
    expect(
      (
        await request(app)
          .post("/api/contact")
          .send({ ...body, email: "x" })
      ).status,
    ).toBe(400);
  });
});
