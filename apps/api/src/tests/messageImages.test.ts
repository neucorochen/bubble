import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPostSchema, sendMessageSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { MessageImage } from "../models/MessageImage.js";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import * as storage from "../services/storageService.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const owner = new mongoose.Types.ObjectId().toString();
const viewer = new mongoose.Types.ObjectId().toString();
const id = new mongoose.Types.ObjectId();
const token = (value: string) => `Bearer ${signAccessToken(value)}`;
afterEach(() => vi.restoreAllMocks());

describe("image attachments", () => {
  it("allows up to ten images and retains old posts and messages", () => {
    const ids = Array.from({ length: 11 }, () => new mongoose.Types.ObjectId().toString());
    const urls = Array.from({ length: 11 }, (_, index) => `/uploads/${index.toString(16).padStart(32, "0")}.png`);
    expect(sendMessageSchema.safeParse({ imageIds: ids.slice(0, 10) }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ imageIds: ids }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ imageIds: [ids[0], ids[0]!.toUpperCase()] }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: "", imageUrls: urls.slice(0, 10) }).success).toBe(true);
    expect(createPostSchema.safeParse({ content: "", imageUrls: urls }).success).toBe(false);
    expect(createPostSchema.safeParse({ content: "", imageUrl: urls[0] }).success).toBe(true);
  });

  it("does not expose a private image to an unrelated user", async () => {
    vi.spyOn(MessageImage, "findById").mockImplementation((() => ({ lean: async () => ({ _id: id, owner, storageKey: "message-images/secret" }) })) as never);
    vi.spyOn(Message, "find").mockImplementation((() => ({ select: () => ({ lean: async () => [{ conversation: new mongoose.Types.ObjectId() }] }) })) as never);
    vi.spyOn(Conversation, "exists").mockResolvedValue(null as never);
    const signer = vi.spyOn(storage, "createDownloadUrl");
    expect((await request(app).get(`/api/messages/images/${id}`).set("Authorization", token(viewer))).status).toBe(404);
    expect(signer).not.toHaveBeenCalled();
    expect((await request(app).get(`/api/messages/images/${id}`)).status).toBe(401);
  });

  it("allows a conversation participant to obtain a short-lived image URL", async () => {
    vi.spyOn(MessageImage, "findById").mockImplementation((() => ({ lean: async () => ({ _id: id, owner, storageKey: "message-images/secret" }) })) as never);
    vi.spyOn(Message, "find").mockImplementation((() => ({ select: () => ({ lean: async () => [{ conversation: new mongoose.Types.ObjectId() }] }) })) as never);
    vi.spyOn(Conversation, "exists").mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as never);
    vi.spyOn(storage, "createDownloadUrl").mockResolvedValue("https://example.test/image");
    const response = await request(app).get(`/api/messages/images/${id}`).set("Authorization", token(viewer));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: "https://example.test/image" });
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("rejects another person's draft before creating a conversation", async () => {
    vi.spyOn(User, "findOne").mockImplementation((() => ({ collation: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(viewer), username: "sam", banned: false }) }) })) as never);
    vi.spyOn(MessageImage, "countDocuments").mockResolvedValue(0 as never);
    const upsert = vi.spyOn(Conversation, "findOneAndUpdate");
    const response = await request(app).post("/api/messages/with/sam").set("Authorization", token(owner)).send({ imageIds: [id.toString()] });
    expect(response.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("sends an image-only first message in order and uses a photo preview", async () => {
    const otherImage = new mongoose.Types.ObjectId();
    const convo = new mongoose.Types.ObjectId();
    vi.spyOn(User, "findOne").mockImplementation((() => ({ collation: () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(viewer), username: "sam", banned: false }) }) })) as never);
    vi.spyOn(MessageImage, "countDocuments").mockResolvedValue(2 as never);
    vi.spyOn(Conversation, "findOneAndUpdate").mockImplementation((() => ({ lean: async () => ({ _id: convo }) })) as never);
    vi.spyOn(Message, "create").mockImplementation((async (data: unknown) => ({ ...(data as object), _id: new mongoose.Types.ObjectId(), createdAt: new Date(), toObject() { return this; } })) as never);
    const update = vi.spyOn(Conversation, "updateOne").mockResolvedValue({} as never);
    const imageIds = [id.toString(), otherImage.toString()];
    const response = await request(app).post("/api/messages/with/sam").set("Authorization", token(owner)).send({ imageIds });
    expect(response.status).toBe(201);
    expect(response.body.message.imageIds).toEqual(imageIds);
    expect((update.mock.calls[0] as unknown as [unknown, unknown])[1]).toMatchObject({ $set: { lastMessageText: "Фото" } });
  });
});
