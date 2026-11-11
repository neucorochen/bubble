import type { Request, Response } from "express";
import { Types, type PipelineStage } from "mongoose";
import type { FriendsAccessDTO, FriendsVisibility, Page, UserSummaryDTO } from "@commune/shared";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { isPlusActive } from "../utils/plan.js";
import { escapeRegex } from "../utils/regex.js";
import { findByUsername } from "./userController.js";

type Query = {
  type: "friends" | "following" | "followers" | "outgoing" | "incoming";
  q: string;
  cursor?: string;
  limit: number;
};
type Row = {
  _id: Types.ObjectId;
  createdAt: Date;
  friendshipAt?: Date;
  person: {
    _id: Types.ObjectId;
    username: string;
    bio?: string;
    avatarUrl?: string | null;
    plusUntil?: Date | null;
  };
};

function parseCursor(cursor: string): { createdAt: Date; id: Types.ObjectId } {
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z)\|([0-9a-f]{24})$/.exec(cursor);
  if (!match) throw badRequest("Invalid relationship cursor");
  const createdAt = new Date(match[1]!);
  if (Number.isNaN(createdAt.valueOf()) || createdAt.toISOString() !== match[1])
    throw badRequest("Invalid relationship cursor");
  return { createdAt, id: new Types.ObjectId(match[2]!) };
}

/** For friends the later of the two follows is the start of the friendship. */
function relationshipPipeline(
  owner: Types.ObjectId,
  { type, q, cursor }: Query,
  sort = true,
): PipelineStage.FacetPipelineStage[] {
  const inbound = type === "followers" || type === "incoming";
  const anchor = inbound ? "following" : "follower";
  const target = inbound ? "follower" : "following";
  const match: Record<string, unknown> = { [anchor]: owner };
  if (cursor !== undefined && type !== "friends") {
    const { createdAt, id } = parseCursor(cursor);
    match.$or = [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: id } }];
  }
  const pipeline: PipelineStage.FacetPipelineStage[] = [{ $match: match }];
  if (sort && type !== "friends") pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
  if (type === "friends" || type === "outgoing" || type === "incoming") {
    pipeline.push(
      {
        $lookup: {
          from: Follow.collection.name,
          let: { other: `$${target}` },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: inbound
                    ? [{ $eq: ["$follower", owner] }, { $eq: ["$following", "$$other"] }]
                    : [{ $eq: ["$follower", "$$other"] }, { $eq: ["$following", owner] }],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "reverse",
        },
      },
      { $match: { "reverse.0": { $exists: type === "friends" } } },
    );
  }
  if (type === "friends" && sort) {
    pipeline.push({
      $addFields: {
        friendshipAt: { $max: ["$createdAt", { $arrayElemAt: ["$reverse.createdAt", 0] }] },
      },
    });
    if (cursor !== undefined) {
      const { createdAt, id } = parseCursor(cursor);
      pipeline.push({
        $match: {
          $or: [
            { friendshipAt: { $lt: createdAt } },
            { friendshipAt: createdAt, _id: { $lt: id } },
          ],
        },
      });
    }
    pipeline.push({ $sort: { friendshipAt: -1, _id: -1 } });
  }
  pipeline.push(
    {
      $lookup: {
        from: User.collection.name,
        localField: target,
        foreignField: "_id",
        as: "person",
      },
    },
    { $unwind: "$person" },
    {
      $match: {
        "person.banned": { $ne: true },
        ...(q ? { "person.username": { $regex: `^${escapeRegex(q)}`, $options: "i" } } : {}),
      },
    },
  );
  return pipeline;
}

async function page(owner: Types.ObjectId, query: Query): Promise<Page<UserSummaryDTO>> {
  const { limit } = query;
  const pipeline = relationshipPipeline(owner, query);
  pipeline.push(
    { $limit: limit + 1 },
    {
      $project: {
        _id: 1,
        createdAt: 1,
        friendshipAt: 1,
        "person._id": 1,
        "person.username": 1,
        "person.bio": 1,
        "person.avatarUrl": 1,
        "person.plusUntil": 1,
      },
    },
  );
  const rows = await Follow.aggregate<Row>(pipeline);
  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  const last = selected[selected.length - 1];
  return {
    items: selected.map(({ person }) => ({
      id: person._id.toString(),
      username: person.username,
      bio: person.bio ?? "",
      avatarUrl: person.avatarUrl ?? null,
      plus: isPlusActive(person.plusUntil),
    })),
    nextCursor:
      hasMore && last
        ? `${(query.type === "friends" ? last.friendshipAt! : last.createdAt).toISOString()}|${last._id.toString()}`
        : null,
  };
}

export async function list(req: Request, res: Response) {
  res.json(await page(new Types.ObjectId(req.userId!), res.locals.query as Query));
}

/** Own totals, independent of search and pagination; one aggregate round trip. */
export async function counts(req: Request, res: Response) {
  const owner = new Types.ObjectId(req.userId!);
  const categories = ["friends", "outgoing", "incoming"] as const;
  const facets = Object.fromEntries(categories.map((type) => [type, [
    ...relationshipPipeline(owner, { type, q: "", limit: 20 }, false),
    { $count: "count" },
  ]]));
  const rows = await Follow.aggregate<Record<string, Array<{ count: number }>>>([
    { $match: { $or: [{ follower: owner }, { following: owner }] } },
    { $facet: facets },
  ]);
  res.json(Object.fromEntries(categories.map((type) => [type, rows[0]?.[type]?.[0]?.count ?? 0])));
}

async function authorizeFriends(username: string | undefined, viewerId: string) {
  const owner = await findByUsername(username);
  const isOwner = owner._id.toString() === viewerId;
  if (owner.banned && !isOwner) throw notFound("User not found");
  const visibility = owner.friendsVisibility ?? "everyone";
  let canView = isOwner || visibility === "everyone";
  if (!canView && visibility === "friends") {
    const [outgoing, incoming] = await Promise.all([
      Follow.exists({ follower: viewerId, following: owner._id }),
      Follow.exists({ follower: owner._id, following: viewerId }),
    ]);
    canView = Boolean(outgoing && incoming);
  }
  return { owner, isOwner, canView, visibility };
}

export async function access(req: Request, res: Response) {
  const { owner, isOwner, canView, visibility } = await authorizeFriends(
    req.params.username,
    req.userId!,
  );
  if (!canView) {
    res.json({ canView: false } satisfies FriendsAccessDTO);
    return;
  }
  const pipeline = relationshipPipeline(owner._id, { type: "friends", q: "", limit: 20 }, false);
  pipeline.push({ $count: "count" });
  const rows = await Follow.aggregate<{ count: number }>(pipeline);
  const body: FriendsAccessDTO = {
    canView: true,
    count: rows[0]?.count ?? 0,
    ...(isOwner ? { friendsVisibility: visibility as FriendsVisibility } : {}),
  };
  res.json(body);
}

export async function friends(req: Request, res: Response) {
  const { owner, canView } = await authorizeFriends(req.params.username, req.userId!);
  if (!canView) throw forbidden("Friends list is private");
  res.json(
    await page(owner._id, { ...(res.locals.query as Omit<Query, "type">), type: "friends" }),
  );
}

export async function updateVisibility(req: Request, res: Response) {
  const user = await User.findByIdAndUpdate(
    req.userId,
    { friendsVisibility: req.body.friendsVisibility },
    { new: true, runValidators: true },
  )
    .select("friendsVisibility")
    .lean();
  if (!user) throw notFound("User not found");
  res.json({ friendsVisibility: user.friendsVisibility ?? "everyone" });
}
