import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import * as realtime from "../services/realtime.js";
import { Post } from "../models/Post.js";

const app = createApp();

afterEach(() => {
  vi.restoreAllMocks();
});

function queryChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const step of ["sort", "limit", "populate"]) chain[step] = vi.fn(() => chain);
  chain.lean = () => Promise.resolve(result);
  return chain;
}

describe("GET /api/public/posts", () => {
  const author = { _id: new mongoose.Types.ObjectId(), username: "sam", avatarUrl: null };
  const row = (content: string) => ({
    _id: new mongoose.Types.ObjectId(),
    content,
    imageUrl: null,
    author,
    likeCount: 2,
    commentCount: 1,
    createdAt: new Date(),
  });

  it("works without logging in and asks only for free posts", async () => {
    const find = vi.spyOn(Post, "find").mockReturnValue(queryChain([row("Hello")]) as never);
    const res = await request(app).get("/api/public/posts");
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledWith({ priceCents: null });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ content: "Hello", likedByMe: false, locked: false });
    expect(res.body.nextCursor).toBeNull();
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("returns the current author presence and display name", async () => {
    const online = vi.spyOn(realtime, "onlineUsers").mockResolvedValue(new Set([author._id.toString()]));
    vi.spyOn(Post, "find").mockReturnValue(queryChain([
      { ...row("Hello"), author: { ...author, displayName: "Сэм" } },
    ]) as never);
    const res = await request(app).get("/api/public/posts");
    expect(res.body.items[0].author).toMatchObject({ displayName: "Сэм", username: "sam", online: true });
    expect(online).toHaveBeenCalledWith([author._id.toString()]);
  });

  it("paginates with a cursor", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => row(`p${i}`));
    vi.spyOn(Post, "find").mockReturnValue(queryChain(rows) as never);
    const res = await request(app).get("/api/public/posts?limit=2");
    expect(res.body.items).toHaveLength(2);
    expect(res.body.nextCursor).toBe(rows[1]!._id.toString());
  });

  it("rejects a bad cursor", async () => {
    const res = await request(app).get("/api/public/posts?cursor=nope");
    expect(res.status).toBe(400);
  });
});
