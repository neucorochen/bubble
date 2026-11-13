import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { Follow } from "../models/Follow.js";
import { Like } from "../models/Like.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import * as notifications from "../services/notificationService.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const me = new mongoose.Types.ObjectId();
const other = new mongoose.Types.ObjectId();
const auth = { Authorization: `Bearer ${signAccessToken(me.toString())}` };
const user = { _id: other, username: "alice", createdAt: new Date("2024-01-01") };
const chain = (value: unknown) => {
  const result = {
    select: () => result,
    collation: () => result,
    sort: () => result,
    limit: () => result,
    populate: () => result,
    lean: async () => value,
  };
  return result;
};
let pairs: Set<string>;
const key = (query: { follower?: unknown; following?: unknown }) =>
  `${query.follower}:${query.following}`;

beforeEach(() => {
  pairs = new Set();
  vi.spyOn(User, "findById").mockImplementation(
    () => chain({ role: "user", banned: false, emailVerified: true }) as never,
  );
  vi.spyOn(User, "findOne").mockImplementation(
    (query: any) =>
      chain(
        query.username === "alice" ? user : query.username === "self" ? { ...user, _id: me } : null,
      ) as never,
  );
  vi.spyOn(Follow, "countDocuments").mockImplementation(
    (query: any) =>
      Promise.resolve(
        [...pairs].filter((p) =>
          query.follower ? p.startsWith(`${query.follower}:`) : p.endsWith(`:${query.following}`),
        ).length,
      ) as never,
  );
  vi.spyOn(Follow, "exists").mockImplementation(
    (query: any) => Promise.resolve(pairs.has(key(query)) ? { _id: other } : null) as never,
  );
  vi.spyOn(Follow, "findOneAndDelete").mockImplementation(
    (query: any) => Promise.resolve(pairs.delete(key(query)) ? { _id: other } : null) as never,
  );
  vi.spyOn(Follow, "create").mockImplementation(async (query: any) => {
    const k = key(query);
    if (pairs.has(k)) throw Object.assign(new Error("duplicate"), { code: 11000 });
    pairs.add(k);
    return { _id: other } as never;
  });
  vi.spyOn(notifications, "notify").mockResolvedValue();
});
afterEach(() => vi.restoreAllMocks());

describe("follow relationship API", () => {
  it("requires authentication for every new route", async () => {
    expect((await request(app).put("/api/users/alice/follow")).status).toBe(401);
    expect((await request(app).delete("/api/users/alice/follow")).status).toBe(401);
    expect((await request(app).get("/api/users/me/relationships?type=friends")).status).toBe(401);
  });

  it("creates, repeats and removes only the viewer's follow; profile reflects both directions", async () => {
    const path = "/api/users/alice/follow";
    const first = await request(app).put(path).set(auth);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ followedByMe: true, followsMe: false });
    expect((await request(app).put(path).set(auth)).body.followedByMe).toBe(true);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    pairs.add(`${other}:${me}`);
    expect((await request(app).get("/api/users/alice").set(auth)).body).toMatchObject({
      followedByMe: true,
      followsMe: true,
    });
    expect((await request(app).delete(path).set(auth)).body).toMatchObject({
      followedByMe: false,
      followsMe: true,
    });
    expect((await request(app).delete(path).set(auth)).body).toMatchObject({
      followedByMe: false,
      followsMe: true,
    });
    expect(pairs.has(`${other}:${me}`)).toBe(true);
  });

  it("handles duplicate-key races without another notification", async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app).put("/api/users/alice/follow").set(auth)),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(pairs.size).toBe(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it("notifies a new one-way request, but not a repeated request or a mutual acceptance", async () => {
    pairs.add(`${other}:${me}`);
    expect((await request(app).put("/api/users/alice/follow").set(auth)).status).toBe(200);
    expect(notifications.notify).not.toHaveBeenCalled();
    pairs.clear();
    await request(app).put("/api/users/alice/follow").set(auth);
    await request(app).put("/api/users/alice/follow").set(auth);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it("rejects self-follow, handles own and missing profiles, and retains POST toggle", async () => {
    expect((await request(app).put("/api/users/self/follow").set(auth)).status).toBe(400);
    expect((await request(app).post("/api/users/self/follow").set(auth)).status).toBe(400);
    expect((await request(app).get("/api/users/self").set(auth)).body).toMatchObject({
      followedByMe: false,
      followsMe: false,
    });
    expect((await request(app).get("/api/users/missing").set(auth)).status).toBe(404);
    expect((await request(app).post("/api/users/alice/follow").set(auth)).body.followedByMe).toBe(
      true,
    );
    expect((await request(app).post("/api/users/alice/follow").set(auth)).body.followedByMe).toBe(
      false,
    );
  });

  it("rejects writes from suspended users", async () => {
    vi.mocked(User.findById).mockReturnValue(chain({ role: "user", banned: true }) as never);
    expect((await request(app).put("/api/users/alice/follow").set(auth)).status).toBe(403);
    expect((await request(app).delete("/api/users/alice/follow").set(auth)).status).toBe(403);
    expect(pairs.size).toBe(0);
  });

  it("keeps the following feed based on the viewer's outgoing follows", async () => {
    vi.spyOn(Follow, "find").mockImplementation(
      (query?: any) =>
        chain(
          [...pairs]
            .filter((p) => p.startsWith(`${query.follower}:`))
            .map((p) => ({ following: new mongoose.Types.ObjectId(p.split(":")[1]) })),
        ) as never,
    );
    const posts = vi.spyOn(Post, "find").mockReturnValue(chain([]) as never);
    vi.spyOn(Like, "find").mockReturnValue(chain([]) as never);
    pairs.add(`${other}:${me}`);
    await request(app).put("/api/users/alice/follow").set(auth);
    expect((await request(app).get("/api/posts?feed=following").set(auth)).status).toBe(200);
    const calls = posts.mock.calls as unknown as Array<[any]>;
    expect(calls[0]![0].author.$in.map(String)).toEqual([other.toString(), me.toString()]);
    await request(app).delete("/api/users/alice/follow").set(auth);
    expect((await request(app).get("/api/posts?feed=following").set(auth)).status).toBe(200);
    expect(calls[1]![0].author.$in.map(String)).toEqual([me.toString()]);
    expect(pairs.has(`${other}:${me}`)).toBe(true);
  });
});

describe("relationship lists", () => {
  it.each(["friends", "following", "followers"])(
    "builds a filtered, paginated %s query",
    async (type) => {
      const createdAt = new Date("2024-01-01T00:00:00.000Z");
      const id = new mongoose.Types.ObjectId();
      const aggregate = vi.spyOn(Follow, "aggregate").mockResolvedValue([
        {
          _id: id,
          createdAt,
          friendshipAt: createdAt,
          person: { _id: other, username: "alice", bio: "hi", avatarUrl: null, secret: "hidden" },
        },
        { _id: new mongoose.Types.ObjectId(), createdAt, person: { _id: other, username: "alex" } },
      ] as never);
      const res = await request(app)
        .get(`/api/users/me/relationships?type=${type}&q=a.b&limit=1`)
        .set(auth);
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([
        { id: other.toString(), username: "alice", bio: "hi", avatarUrl: null, plus: false },
      ]);
      expect(res.body.nextCursor).toBe(`${createdAt.toISOString()}|${id}`);
      const pipeline = aggregate.mock.calls[0]![0]!;
      expect(JSON.stringify(pipeline)).toContain("person.banned");
      expect(JSON.stringify(pipeline)).toContain("a\\\\.b");
      expect(JSON.stringify(pipeline)).toContain(
        type === "friends" ? '"friendshipAt":-1' : '"createdAt":-1',
      );
      expect(JSON.stringify(pipeline)).toContain(
        type === "followers" ? '"following"' : '"follower"',
      );
      expect(JSON.stringify(pipeline)).toContain(type === "friends" ? '"reverse.0"' : '"person"');
      expect(JSON.stringify(pipeline).indexOf("person.banned")).toBeLessThan(
        JSON.stringify(pipeline).lastIndexOf('"$limit"'),
      );
      const next = await request(app)
        .get("/api/users/me/relationships")
        .query({ type, cursor: res.body.nextCursor })
        .set(auth);
      expect(next.status).toBe(200);
      expect(JSON.stringify(aggregate.mock.calls[1]![0])).toContain('"$or"');
    },
  );

  it("returns empty lists and rejects invalid inputs without a database query", async () => {
    const aggregate = vi.spyOn(Follow, "aggregate").mockResolvedValue([] as never);
    expect(
      (await request(app).get("/api/users/me/relationships?type=friends&q=absent").set(auth)).body,
    ).toEqual({ items: [], nextCursor: null });
    for (const query of [
      "type=wrong",
      "type=friends&limit=0",
      "type=friends&limit=51",
      "type=friends&cursor=invalid",
      `type=friends&q=${"x".repeat(51)}`,
    ]) {
      expect(
        (await request(app).get(`/api/users/me/relationships?${query}`).set(auth)).status,
      ).toBe(400);
    }
    expect(aggregate).toHaveBeenCalledTimes(1);
  });
});

describe("profile friends privacy", () => {
  it("requires authentication for access, friends and settings", async () => {
    expect((await request(app).get("/api/users/alice/friends/access")).status).toBe(401);
    expect((await request(app).get("/api/users/alice/friends")).status).toBe(401);
    expect(
      (
        await request(app)
          .patch("/api/users/me/friends-visibility")
          .send({ friendsVisibility: "everyone" })
      ).status,
    ).toBe(401);
  });

  it("defaults missing visibility to everyone and counts only accessible friend records", async () => {
    const aggregate = vi.spyOn(Follow, "aggregate").mockResolvedValue([{ count: 2 }] as never);
    const result = await request(app).get("/api/users/alice/friends/access").set(auth);
    expect(result.body).toEqual({ canView: true, count: 2 });
    expect(JSON.stringify(aggregate.mock.calls[0]![0])).toContain("person.banned");
    expect(JSON.stringify(aggregate.mock.calls[0]![0])).toContain('"$count"');
    aggregate.mockResolvedValue([] as never);
    expect((await request(app).get("/api/users/alice/friends?q=a.b").set(auth)).body).toEqual({
      items: [],
      nextCursor: null,
    });
    expect(JSON.stringify(aggregate.mock.calls[1]![0])).toContain("a\\\\.b");
  });

  it.each(["friends", "only_me"])(
    "denies %s access before querying lists or count",
    async (mode) => {
      vi.mocked(User.findOne).mockReturnValue(chain({ ...user, friendsVisibility: mode }) as never);
      const aggregate = vi.spyOn(Follow, "aggregate").mockResolvedValue([] as never);
      expect((await request(app).get("/api/users/alice/friends/access").set(auth)).body).toEqual({
        canView: false,
      });
      expect(
        (await request(app).get("/api/users/alice/friends?q=alice&cursor=bad").set(auth)).status,
      ).toBe(403);
      expect(aggregate).not.toHaveBeenCalled();
    },
  );

  it("allows mutual friends only and revokes access after unfollow", async () => {
    vi.mocked(User.findOne).mockReturnValue(
      chain({ ...user, friendsVisibility: "friends" }) as never,
    );
    vi.spyOn(Follow, "aggregate").mockResolvedValue([] as never);
    pairs.add(`${me}:${other}`);
    expect((await request(app).get("/api/users/alice/friends/access").set(auth)).body).toEqual({
      canView: false,
    });
    pairs.add(`${other}:${me}`);
    expect((await request(app).get("/api/users/alice/friends/access").set(auth)).body).toEqual({
      canView: true,
      count: 0,
    });
    expect((await request(app).get("/api/users/alice/friends").set(auth)).status).toBe(200);
    await request(app).delete("/api/users/alice/follow").set(auth);
    expect((await request(app).get("/api/users/alice/friends/access").set(auth)).body).toEqual({
      canView: false,
    });
    expect(pairs.has(`${other}:${me}`)).toBe(true);
  });

  it("always allows owner and conceals banned profiles from others", async () => {
    vi.mocked(User.findOne).mockReturnValue(
      chain({ ...user, _id: me, friendsVisibility: "only_me" }) as never,
    );
    vi.spyOn(Follow, "aggregate").mockResolvedValue([] as never);
    expect((await request(app).get("/api/users/self/friends/access").set(auth)).body).toEqual({
      canView: true,
      count: 0,
      friendsVisibility: "only_me",
    });
    vi.mocked(User.findOne).mockReturnValue(chain({ ...user, banned: true }) as never);
    expect((await request(app).get("/api/users/alice/friends/access").set(auth)).status).toBe(404);
    expect((await request(app).get("/api/users/alice/friends").set(auth)).status).toBe(404);
  });

  it("validates settings and only updates the authenticated user", async () => {
    const update = vi
      .spyOn(User, "findByIdAndUpdate")
      .mockReturnValue(chain({ friendsVisibility: "friends" }) as never);
    expect(
      (
        await request(app)
          .patch("/api/users/me/friends-visibility")
          .set(auth)
          .send({ friendsVisibility: "friends" })
      ).body,
    ).toEqual({ friendsVisibility: "friends" });
    expect(update.mock.calls[0]![0]).toBe(me.toString());
    for (const body of [
      { friendsVisibility: "invalid" },
      { friendsVisibility: "everyone", user: other.toString() },
    ]) {
      expect(
        (await request(app).patch("/api/users/me/friends-visibility").set(auth).send(body)).status,
      ).toBe(400);
    }
    expect(update).toHaveBeenCalledTimes(1);
  });
});
