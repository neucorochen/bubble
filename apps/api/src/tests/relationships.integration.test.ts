import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { signAccessToken } from "../utils/tokens.js";

// Explicitly opt in: never use the application's configured database for integration tests.
const integration = process.env.BUBBLE_LOCAL_MONGO_TEST === "1" ? describe : describe.skip;
integration("relationships with isolated local MongoDB", () => {
  const name = `bubble_codex_test_${randomUUID().replaceAll("-", "")}`;
  const app = createApp();
  let owner: mongoose.Types.ObjectId;
  let viewer: mongoose.Types.ObjectId;
  let third: mongoose.Types.ObjectId;
  let auth: { Authorization: string };
  let ownsDatabase = false;
  beforeAll(async () => {
    await mongoose.connect(`mongodb://127.0.0.1:27017/${name}`, { serverSelectionTimeoutMS: 3000 });
    if ((await mongoose.connection.db!.listCollections().toArray()).length !== 0)
      throw new Error("Test database is not empty");
    ownsDatabase = true;
    await Follow.createIndexes();
    const users = await User.create([
      { username: "owner", email: "owner@example.invalid", passwordHash: "test" },
      { username: "viewer", email: "viewer@example.invalid", passwordHash: "test" },
      { username: "third", email: "third@example.invalid", passwordHash: "test" },
    ]);
    [owner, viewer, third] = users.map((u) => u._id) as [
      mongoose.Types.ObjectId,
      mongoose.Types.ObjectId,
      mongoose.Types.ObjectId,
    ];
    auth = { Authorization: `Bearer ${signAccessToken(viewer.toString())}` };
  });
  beforeEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (
      ownsDatabase &&
      mongoose.connection.readyState === 1 &&
      mongoose.connection.name === name &&
      /^bubble_codex_test_[a-f0-9]{32}$/.test(name)
    )
      await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("enforces the unique index and idempotent concurrent PUTs", async () => {
    const index = (await Follow.collection.indexes()).find(
      (i) => i.key.follower === 1 && i.key.following === 1,
    );
    expect(index?.unique).toBe(true);
    const replies = await Promise.all(
      Array.from({ length: 5 }, () => request(app).put("/api/users/owner/follow").set(auth)),
    );
    expect(replies.every((r) => r.status === 200)).toBe(true);
    expect(await Follow.countDocuments({ follower: viewer, following: owner })).toBe(1);
  });

  it("checks privacy, friend counts, and equal-timestamp cursors on real data", async () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    await User.collection.updateOne({ _id: owner }, { $unset: { friendsVisibility: "" } });
    expect((await request(app).get("/api/users/owner/friends/access").set(auth)).body).toEqual({
      canView: true,
      count: 0,
    });
    await Follow.create([
      { follower: owner, following: viewer, createdAt },
      { follower: owner, following: third, createdAt },
      { follower: third, following: owner, createdAt },
    ]);
    await User.updateOne({ _id: owner }, { friendsVisibility: "friends" });
    expect((await request(app).get("/api/users/owner/friends/access").set(auth)).body).toEqual({
      canView: true,
      count: 2,
    });
    const first = await request(app).get("/api/users/owner/friends?limit=1").set(auth);
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(1);
    const second = await request(app)
      .get("/api/users/owner/friends")
      .query({ limit: 1, cursor: first.body.nextCursor })
      .set(auth);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    expect(second.body.nextCursor).toBeNull();
    const search = await request(app).get("/api/users/owner/friends?q=thi").set(auth);
    expect(search.body.items.map((u: { username: string }) => u.username)).toEqual(["third"]);
    await User.updateOne({ _id: third }, { banned: true });
    expect((await request(app).get("/api/users/owner/friends/access").set(auth)).body.count).toBe(
      1,
    );
    expect(
      (await request(app).get("/api/users/owner/friends").set(auth)).body.items.map(
        (u: { username: string }) => u.username,
      ),
    ).toEqual(["viewer"]);
    await User.updateOne({ _id: owner }, { friendsVisibility: "only_me" });
    expect((await request(app).get("/api/users/owner/friends/access").set(auth)).body).toEqual({
      canView: false,
    });
    await User.updateOne({ _id: owner }, { friendsVisibility: "everyone" });
    expect((await request(app).get("/api/users/owner/friends/access").set(auth)).body).toEqual({
      canView: true,
      count: 1,
    });
    await User.updateOne({ _id: owner }, { friendsVisibility: "friends" });
    await request(app).delete("/api/users/owner/follow").set(auth);
    expect((await request(app).get("/api/users/owner/friends/access").set(auth)).body).toEqual({
      canView: false,
    });
    expect((await request(app).get("/api/users/owner/friends?q=viewer").set(auth)).status).toBe(
      403,
    );
    expect(await Follow.exists({ follower: owner, following: viewer })).toBeTruthy();
  });

  it("persists each visibility choice for the signed-in account", async () => {
    for (const friendsVisibility of ["everyone", "friends", "only_me"]) {
      const res = await request(app)
        .patch("/api/users/me/friends-visibility")
        .set(auth)
        .send({ friendsVisibility });
      expect(res.status).toBe(200);
      expect((await User.findById(viewer).lean())?.friendsVisibility).toBe(friendsVisibility);
      expect(
        (await request(app).get("/api/users/viewer/friends/access").set(auth)).body,
      ).toMatchObject({ canView: true, friendsVisibility });
    }
  });

  it("sorts by when friendship became mutual and separates one-way requests", async () => {
    const entries = [
      "person",
      ...Array.from({ length: 7 }, (_, i) => `friend${i}`),
      "outbound",
      "inbound",
    ];
    const people = await User.create(
      entries.map((username) => ({
        username,
        email: `${username}@example.invalid`,
        passwordHash: "test",
      })),
    );
    const person = people[0]!;
    const forward = people
      .slice(1, 8)
      .map((u, i) => ({
        follower: person._id,
        following: u._id,
        createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, i)),
      }));
    const reverse = people
      .slice(1, 8)
      .map((u, i) => ({
        follower: u._id,
        following: person._id,
        createdAt: new Date(Date.UTC(2024, 1, 1, 0, 0, 6 - i)),
      }));
    await Follow.collection.insertMany([
      ...forward,
      ...reverse,
      { follower: person._id, following: people[8]!._id, createdAt: new Date() },
      { follower: people[9]!._id, following: person._id, createdAt: new Date() },
    ]);
    const session = { Authorization: `Bearer ${signAccessToken(person._id.toString())}` };
    expect((await request(app).get("/api/users/me/relationships/counts?q=absent&limit=1").set(session)).body).toEqual({ friends: 7, outgoing: 1, incoming: 1 });
    expect((await request(app).get("/api/users/me/relationships/counts")).status).toBe(401);
    const first = await request(app).get("/api/users/person/friends?limit=6").set(session);
    expect(first.body.items.map((u: { username: string }) => u.username)).toEqual(
      entries.slice(1, 7),
    );
    const second = await request(app)
      .get("/api/users/person/friends")
      .query({ cursor: first.body.nextCursor })
      .set(session);
    expect(second.body.items.map((u: { username: string }) => u.username)).toEqual(["friend6"]);
    for (const [type, expected] of [
      ["outgoing", "outbound"],
      ["incoming", "inbound"],
    ]) {
      const res = await request(app)
        .get("/api/users/me/relationships")
        .query({ type })
        .set(session);
      expect(res.body.items.map((u: { username: string }) => u.username)).toEqual([expected]);
      const search = await request(app)
        .get("/api/users/me/relationships")
        .query({ type, q: "absent" })
        .set(session);
      expect(search.body.items).toEqual([]);
    }
    for (const type of ["following", "followers"]) {
      const res = await request(app)
        .get("/api/users/me/relationships")
        .query({ type })
        .set(session);
      expect(res.body.items).toHaveLength(8);
    }
  });

  it("paginates identical friendship timestamps without gaps or duplicates", async () => {
    const people = await User.create(
      ["tieowner", "tiea", "tieb", "tiec"].map((username) => ({
        username,
        email: `${username}@example.invalid`,
        passwordHash: "test",
      })),
    );
    const ownerId = people[0]!._id;
    const createdAt = new Date("2024-04-01T00:00:00.000Z");
    await Follow.collection.insertMany(
      people.slice(1).flatMap((p) => [
        { follower: ownerId, following: p._id, createdAt },
        { follower: p._id, following: ownerId, createdAt },
      ]),
    );
    const session = { Authorization: `Bearer ${signAccessToken(ownerId.toString())}` };
    let cursor: string | null = null;
    const ids: string[] = [];
    do {
      const res: {
        status: number;
        body: { items: Array<{ id: string }>; nextCursor: string | null };
      } = await request(app)
        .get("/api/users/tieowner/friends")
        .query({ limit: 1, ...(cursor ? { cursor } : {}) })
        .set(session);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      ids.push(res.body.items[0]!.id);
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });
});
