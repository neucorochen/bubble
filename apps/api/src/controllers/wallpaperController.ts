import type { Request, Response } from "express";
import { Types, type PipelineStage } from "mongoose";
import {
  unnamedWallpaper,
  wallpaperNameSchema,
  type WallpaperDTO,
  type WallpaperPage,
  type wallpaperQuerySchema,
} from "@commune/shared";
import type { z } from "zod";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { Wallpaper, WallpaperReaction, WallpaperReport } from "../models/Wallpaper.js";
import { deleteUploadIfUnused } from "../services/uploadService.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import { escapeRegex } from "../utils/regex.js";
import { idParam } from "../utils/params.js";
import { storeUploadedImage } from "./uploadController.js";

async function mutualFriends(viewer: Types.ObjectId) {
  return Follow.aggregate<{ _id: Types.ObjectId; backgroundUrl?: string | null }>([
    { $match: { follower: viewer } },
    {
      $lookup: {
        from: Follow.collection.name,
        localField: "following",
        foreignField: "follower",
        pipeline: [{ $match: { following: viewer } }, { $limit: 1 }],
        as: "reverse",
      },
    },
    { $match: { "reverse.0": { $exists: true } } },
    {
      $lookup: {
        from: User.collection.name,
        localField: "following",
        foreignField: "_id",
        pipeline: [
          { $match: { banned: { $ne: true } } },
          { $project: { "appearance.backgroundUrl": 1 } },
        ],
        as: "friend",
      },
    },
    { $unwind: "$friend" },
    { $project: { _id: "$friend._id", backgroundUrl: "$friend.appearance.backgroundUrl" } },
  ]);
}

export async function list(req: Request, res: Response) {
  const { view, page, q } = res.locals.query as z.infer<typeof wallpaperQuerySchema>;
  const viewer = new Types.ObjectId(req.userId!);
  const popular = view === "popular";
  const pageSize = view === "favorites" ? 8 : 15;
  const pipeline: PipelineStage[] = [];
  if (q) pipeline.push({ $match: { name: { $regex: escapeRegex(q), $options: "i" } } });

  const usedImages = new Set<string>();
  if (view === "friends") {
    const friends = await mutualFriends(viewer);
    for (const friend of friends) if (friend.backgroundUrl) usedImages.add(friend.backgroundUrl);
    pipeline.push({
      $match: {
        $or: [
          { author: { $in: friends.map((friend) => friend._id) } },
          { imageUrl: { $in: [...usedImages] } },
        ],
      },
    });
  }
  pipeline.push(
    {
      $lookup: {
        from: User.collection.name,
        localField: "author",
        foreignField: "_id",
        pipeline: [{ $match: { banned: { $ne: true } } }, { $project: { username: 1, displayName: 1 } }],
        as: "owner",
      },
    },
    { $unwind: "$owner" },
    {
      $lookup: {
        from: WallpaperReaction.collection.name,
        localField: "_id",
        foreignField: "wallpaper",
        pipeline: [{ $match: { user: viewer } }, { $project: { kind: 1 } }],
        as: "myReactions",
      },
    },
  );
  if (view === "favorites") pipeline.push({ $match: { "myReactions.kind": "favorite" } });
  const newestPage: PipelineStage.FacetPipelineStage[] = [
    { $sort: { _id: -1 } },
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
  ];
  const rows: PipelineStage.FacetPipelineStage[] = popular ? [] : [...newestPage];
  rows.push(
    {
      $lookup: {
        from: WallpaperReaction.collection.name,
        localField: "_id",
        foreignField: "wallpaper",
        pipeline: [{ $match: { kind: "like" } }, { $count: "total" }],
        as: "likes",
      },
    },
    { $set: { likeCount: { $ifNull: [{ $first: "$likes.total" }, 0] } } },
  );
  if (popular) {
    rows.push(
      { $sort: { likeCount: -1, _id: -1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
    );
  }
  rows.push({
    $project: {
      imageUrl: 1,
      name: 1,
      likeCount: 1,
      username: "$owner.username",
      displayName: "$owner.displayName",
      mine: { $eq: ["$author", viewer] },
      liked: { $in: ["like", "$myReactions.kind"] },
      favorite: { $in: ["favorite", "$myReactions.kind"] },
    },
  });

  type Row = Omit<WallpaperDTO, "id" | "author" | "name" | "usedByFriends"> & {
    _id: Types.ObjectId;
    username: string;
    displayName?: string;
    name?: string;
  };
  const [result] = await Wallpaper.aggregate<{ rows: Row[]; count: { total: number }[] }>([
    ...pipeline,
    { $facet: { rows, count: [{ $count: "total" }] } },
  ]);
  const response: WallpaperPage = {
    items: (result?.rows ?? []).map(({ _id, username, displayName, name, ...row }) => ({
      ...row,
      id: _id.toString(),
      author: displayName || username,
      name: name || unnamedWallpaper,
      usedByFriends: usedImages.has(row.imageUrl),
    })),
    totalPages: Math.ceil((result?.count[0]?.total ?? 0) / pageSize),
  };
  res.set("Cache-Control", "private, no-store").json(response);
}

export async function publish(req: Request, res: Response) {
  const name = wallpaperNameSchema.safeParse(req.body?.name);
  if (!name.success) throw badRequest(name.error.issues[0]!.message);
  const imageUrl = await storeUploadedImage(req.file);
  try {
    await Wallpaper.create({ author: req.userId, imageUrl, name: name.data });
  } catch (error) {
    await deleteUploadIfUnused(imageUrl);
    throw error;
  }
  res.status(201).json({ url: imageUrl });
}

async function availableWallpaper(req: Request) {
  const wallpaper = await Wallpaper.findById(idParam(req, "id")).select("author").lean();
  if (!wallpaper || !(await User.exists({ _id: wallpaper.author, banned: { $ne: true } }))) {
    throw notFound("Wallpaper not found");
  }
  return wallpaper;
}

export function reactToWallpaper(kind: "like" | "favorite", enabled: boolean) {
  return async (req: Request, res: Response) => {
    const wallpaper = await availableWallpaper(req);
    const key = { wallpaper: wallpaper._id, user: req.userId, kind };
    if (enabled) {
      try {
        await WallpaperReaction.updateOne(key, { $setOnInsert: key }, { upsert: true });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    } else {
      await WallpaperReaction.deleteOne(key);
    }
    res.status(204).end();
  };
}

export async function report(req: Request, res: Response) {
  const wallpaper = await availableWallpaper(req);
  if (wallpaper.author.toString() === req.userId)
    throw badRequest("You can't report your own wallpaper");
  try {
    await WallpaperReport.create({
      wallpaper: wallpaper._id,
      reporter: req.userId,
      reason: req.body.reason,
      details: req.body.details ?? "",
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      throw conflict("You already reported this wallpaper");
    throw error;
  }
  res.status(201).json({ ok: true });
}
