import mongoose from "mongoose";
import type { Request, Response } from "express";
import type { Page, PostDTO } from "@commune/shared";
import { onlineUsers } from "../services/realtime.js";
import { Post } from "../models/Post.js";
import { badRequest } from "../utils/errors.js";
import { toPostDTO, type PopulatedPost } from "../utils/serializers.js";

/**
 * Latest posts for logged-out visitors. Paid posts are excluded entirely (not even teasers),
 * and nothing viewer-specific (likes) is included, so the response is the same for everyone.
 */
export async function listPosts(_req: Request, res: Response) {
  const { cursor, limit } = (res.locals as { query: { cursor?: string; limit: number } }).query;
  if (cursor && !mongoose.isValidObjectId(cursor)) throw badRequest("Invalid cursor");

  const filter = cursor ? { priceCents: null, _id: { $lt: cursor } } : { priceCents: null };
  const rows = (await Post.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("author", "username displayName avatarUrl avatarFrame plusUntil")
    .populate("community", "slug name")
    .lean()) as unknown as PopulatedPost[];

  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  const online = await onlineUsers(posts.map((post) => post.author._id.toString()));
  const body: Page<PostDTO> = {
    items: posts.map((p) => toPostDTO(p, false, true, online.has(p.author._id.toString()))),
    nextCursor: hasMore ? (posts[posts.length - 1]?._id.toString() ?? null) : null,
  };
  res.set("Cache-Control", "no-store");
  res.json(body);
}
