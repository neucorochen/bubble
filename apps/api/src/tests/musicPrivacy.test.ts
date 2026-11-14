import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { createApp } from "../app.js";
import { User } from "../models/User.js";
import { UserMusic } from "../models/UserMusic.js";
import { MusicTrack } from "../models/MusicTrack.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const ownerId = "507f1f77bcf86cd799439011";
const viewerId = "507f1f77bcf86cd799439012";
const token = (id: string) => `Bearer ${signAccessToken(id)}`;

afterEach(() => vi.restoreAllMocks());

describe("music library privacy", () => {
  it("returns batch membership only for the authenticated user", async () => {
    const trackId = "507f1f77bcf86cd799439013";
    const find = vi.spyOn(UserMusic, "find").mockImplementation((() => ({ select: () => ({ lean: async () => [{ trackId: new Types.ObjectId(trackId) }] }) })) as never);
    expect((await request(app).post("/api/music/library/status").send({ ids: [trackId] })).status).toBe(401);
    const response = await request(app).post("/api/music/library/status").set("Authorization", token(viewerId)).send({ ids: [trackId] });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ids: [trackId] });
    expect((find.mock.calls[0] as unknown as [unknown])[0]).toEqual({ userId: viewerId, trackId: { $in: [trackId] } });
    expect((await request(app).post("/api/music/library/status").set("Authorization", token(viewerId)).send({ ids: ["invalid"] })).status).toBe(400);
  });
  it("defaults new users to everyone", () => {
    expect(new User().musicLibraryVisibility).toBe("everyone");
  });

  it.each(["/api/users/me/music-settings", "/api/users/owner/music"])("requires authorization for %s", async (url) => {
    expect((await request(app).get(url)).status).toBe(401);
  });

  it("rejects invalid settings before updating a user", async () => {
    const update = vi.spyOn(User, "findByIdAndUpdate");
    const response = await request(app).patch("/api/users/me/music-settings").set("Authorization", token(viewerId)).send({ visibility: "friends" });
    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("uses everyone for an existing user with no setting", async () => {
    vi.spyOn(User, "findById").mockImplementation((() => ({ select: () => ({ lean: async () => ({}) }) })) as never);
    const response = await request(app).get("/api/users/me/music-settings").set("Authorization", token(ownerId));
    expect(response.body).toEqual({ visibility: "everyone" });
  });

  it("updates only the authenticated user's setting", async () => {
    const update = vi.spyOn(User, "findByIdAndUpdate").mockImplementation((() => ({ lean: async () => ({ musicLibraryVisibility: "private" }) })) as never);
    const response = await request(app).patch("/api/users/me/music-settings").set("Authorization", token(ownerId)).send({ visibility: "private" });
    expect(response.status).toBe(200);
    expect(update.mock.calls[0]?.[0]).toBe(ownerId);
    expect(response.body).toEqual({ visibility: "private" });
    expect((await request(app).patch("/api/users/other/music-settings").set("Authorization", token(ownerId)).send({ visibility: "private" })).status).toBe(404);
  });

  it("returns hidden before querying the library", async () => {
    vi.spyOn(User, "findOne").mockImplementation((() => ({ collation: () => ({ lean: async () => ({ _id: new Types.ObjectId(ownerId), musicLibraryVisibility: "private" }) }) })) as never);
    const find = vi.spyOn(UserMusic, "find");
    const response = await request(app).get("/api/users/OWNER/music").set("Authorization", token(viewerId));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "hidden" });
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(find).not.toHaveBeenCalled();
  });

  it.each([undefined, "everyone", "private"])("lets the owner read a library with visibility %s", async (visibility) => {
    vi.spyOn(User, "findOne").mockImplementation((() => ({ collation: () => ({ lean: async () => ({ _id: new Types.ObjectId(ownerId), musicLibraryVisibility: visibility }) }) })) as never);
    vi.spyOn(UserMusic, "find").mockImplementation((() => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }), lean: async () => [] })) as never);
    vi.spyOn(MusicTrack, "find").mockImplementation((() => ({ lean: async () => [] })) as never);
    const response = await request(app).get("/api/users/owner/music").set("Authorization", token(ownerId));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "visible", tracks: [], nextCursor: null });
  });

  it("paginates using timestamp and id and keeps viewer dates separate", async () => {
    vi.spyOn(User, "findOne").mockImplementation((() => ({ collation: () => ({ lean: async () => ({ _id: new Types.ObjectId(ownerId) }) }) })) as never);
    const date = new Date("2026-01-01T00:00:00Z");
    const entries = Array.from({ length: 6 }, (_, index) => ({ _id: new Types.ObjectId((100 - index).toString(16).padStart(24, "0")), trackId: new Types.ObjectId((200 - index).toString(16).padStart(24, "0")), createdAt: date }));
    const viewedDate = new Date("2026-02-01T00:00:00Z");
    const queries: Array<Record<string, unknown>> = [];
    vi.spyOn(UserMusic, "find").mockImplementation(((query: Record<string, unknown>) => {
      queries.push(query);
      return {
        sort: () => ({ limit: () => ({ lean: async () => "$or" in query ? [entries[5]] : entries }) }),
        lean: async () => [{ trackId: entries[0]!.trackId, createdAt: viewedDate }],
      };
    }) as never);
    vi.spyOn(MusicTrack, "find").mockImplementation((() => ({ lean: async () => entries.map((entry) => ({ _id: entry.trackId, title: "Title", artist: "Artist", mimeType: "audio/mpeg", size: 1, duration: null })) })) as never);
    const first = await request(app).get("/api/users/owner/music").set("Authorization", token(viewerId));
    expect(first.body.tracks).toHaveLength(5);
    expect(first.body.tracks[0].addedAt).toBe(viewedDate.toISOString());
    expect(first.body.tracks[1].addedAt).toBeNull();
    const second = await request(app).get("/api/users/owner/music").query({ cursor: first.body.nextCursor }).set("Authorization", token(viewerId));
    expect(second.body.tracks).toHaveLength(1);
    expect(second.body.tracks[0].id).not.toBe(first.body.tracks[0].id);
    expect(queries.some((query) => "$or" in query)).toBe(true);
  });
});
