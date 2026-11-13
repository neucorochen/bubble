import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { paginationSchema, updateProfileSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { User } from "../models/User.js";
import { toAccountUser, toProfileDTO } from "../utils/serializers.js";
import { Types } from "mongoose";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();

describe("social routes require auth", () => {
  const protectedRoutes: Array<[string, string]> = [
    ["get", "/api/users/someone"],
    ["get", "/api/users/someone/posts"],
    ["post", "/api/users/someone/follow"],
    ["patch", "/api/users/me"],
    ["patch", "/api/users/me/appearance"],
    ["get", "/api/notifications"],
    ["get", "/api/notifications/unread-count"],
    ["post", "/api/notifications/read"],
  ];

  it.each(protectedRoutes)("%s %s returns 401 without a token", async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
      method
    ]!(path);
    expect(res.status).toBe(401);
  });
});

describe("profile validation", () => {
  const token = signAccessToken("507f1f77bcf86cd799439011");

  it("rejects a bio longer than 160 characters", async () => {
    const res = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "x".repeat(161) });
    expect(res.status).toBe(400);
  });

  it("updates the display name while keeping the registered ID", async () => {
    const user = { _id: new Types.ObjectId("507f1f77bcf86cd799439011"), username: "alice",
      displayName: "Алиса ✨", createdAt: new Date() };
    vi.spyOn(User, "findById").mockReturnValue({ select: () => ({ lean: async () => user }) } as never);
    const update = vi.spyOn(User, "findByIdAndUpdate").mockReturnValue({ lean: async () => user } as never);
    try {
      const res = await request(app).patch("/api/users/me").set("Authorization", `Bearer ${token}`)
        .send({ displayName: "  Алиса ✨  ", username: "new_id" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ username: "alice", displayName: "Алиса ✨" });
      expect(update).toHaveBeenCalledWith(user._id.toString(), { displayName: "Алиса ✨" },
        { new: true, runValidators: true });
    } finally { vi.restoreAllMocks(); }
  });

  it.each([" ", "foo\nbar", "x".repeat(41)])("rejects an invalid display name", async (displayName) => {
    const res = await request(app).patch("/api/users/me").set("Authorization", `Bearer ${token}`).send({ displayName });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown feed type", async () => {
    const res = await request(app)
      .get("/api/posts?feed=everything")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("shared schemas", () => {
  it("defaults the feed to 'all'", () => {
    expect(paginationSchema.parse({}).feed).toBe("all");
  });

  it("accepts the following feed", () => {
    expect(paginationSchema.parse({ feed: "following" }).feed).toBe("following");
  });

  it("trims and accepts a valid bio", () => {
    expect(updateProfileSchema.parse({ bio: "  hello  " }).bio).toBe("hello");
  });
});

describe("account appearance", () => {
  const id = new Types.ObjectId();
  const auth = { Authorization: `Bearer ${signAccessToken(id.toString())}` };
  const frame = { effect: "pulse" as const, color: "#e91e63", intensity: 3 };

  it.each([
    {},
    { appearance: {} },
    { appearance: { primaryColor: "red" } },
    { appearance: { backgroundUrl: "https://example.test/image.png" } },
    { avatarFrame: { ...frame, intensity: 6 } },
  ])("rejects invalid appearance input", async (body) => {
    const res = await request(app).patch("/api/users/me/appearance").set(auth).send(body);
    expect(res.status).toBe(400);
  });

  it("changes only the supplied appearance fields on the signed-in account", async () => {
    const update = vi.spyOn(User, "findByIdAndUpdate").mockImplementationOnce((() => ({
      select: () => ({ lean: async () => ({ _id: id }) }),
    })) as never);
    try {
      const res = await request(app).patch("/api/users/me/appearance").set(auth).send({
        appearance: { primaryColor: "#71368A" }, avatarFrame: null,
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ appearance: { primaryColor: "#71368a" }, avatarFrame: null });
      expect(update).toHaveBeenCalledWith(
        id.toString(),
        { $set: { "appearance.primaryColor": "#71368a", avatarFrame: null } },
        { returnDocument: "before", runValidators: true },
      );
    } finally {
      update.mockRestore();
    }
  });

  it("returns the saved font to the owner", () => {
    const user = { _id: id, username: "alice", createdAt: new Date(), appearance: { font: "georgia" } };
    expect(toAccountUser(user).appearance?.font).toBe("georgia");
    expect(toProfileDTO(user, { followerCount: 0, followingCount: 0 }, false, false))
      .not.toHaveProperty("appearance");
  });

  it("returns the avatar frame to profile visitors and keeps the site theme private", () => {
    const user = {
      _id: id, username: "alice", createdAt: new Date(), avatarFrame: frame,
      appearance: { primaryColor: "#71368a", backgroundUrl: `/uploads/${"a".repeat(32)}.webp` },
    };
    expect(toAccountUser(user).appearance).toEqual(user.appearance);
    const profile = toProfileDTO(user, { followerCount: 0, followingCount: 0 }, false, false);
    expect(profile.avatarFrame).toEqual(frame);
    expect(profile).not.toHaveProperty("appearance");
  });
});
