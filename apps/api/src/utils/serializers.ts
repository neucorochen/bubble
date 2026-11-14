import type { Types } from "mongoose";
import { isPlusActive } from "./plan.js";
import type {
  AccountUser,
  FriendsVisibility,
  AvatarFrame,
  SiteAppearance,
  CommentDTO,
  CommunityDTO,
  NotificationDTO,
  NotificationType,
  PostDTO,
  ProfileDTO,
  PublicUser,
  ReportDTO,
  ReportReason,
  ReportStatus,
} from "@commune/shared";

interface UserLike {
  _id: Types.ObjectId;
  username: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarFrame?: AvatarFrame | null;
  role?: string | null;
  banned?: boolean | null;
  emailVerified?: boolean | null;
  plusUntil?: Date | null;
  createdAt: Date;
}

interface PopulatedAuthor {
  _id: Types.ObjectId;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  avatarFrame?: AvatarFrame | null;
  plusUntil?: Date | null;
}

export interface PopulatedPost {
  _id: Types.ObjectId;
  content: string;
  imageUrl?: string | null;
  priceCents?: number | null;
  premiumContent?: string | null;
  community?: { slug: string; name: string } | null;
  author: PopulatedAuthor;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
}

export interface PopulatedComment {
  _id: Types.ObjectId;
  post: Types.ObjectId;
  content: string;
  author: PopulatedAuthor;
  createdAt: Date;
}

export interface PopulatedNotification {
  _id: Types.ObjectId;
  type: NotificationType;
  actor: { _id: Types.ObjectId; username: string; displayName?: string | null };
  post: Types.ObjectId | null;
  read: boolean;
  createdAt: Date;
}

export interface PopulatedReport {
  _id: Types.ObjectId;
  reason: ReportReason;
  details?: string | null;
  status: ReportStatus;
  reporter: { _id: Types.ObjectId; username: string; displayName?: string | null };
  post: {
    _id: Types.ObjectId;
    content: string;
    imageUrl?: string | null;
    author: PopulatedAuthor;
  } | null;
  createdAt: Date;
  resolvedAt?: Date | null;
}

const toAuthor = (a: PopulatedAuthor) => ({
  id: a._id.toString(),
  username: a.username,
  displayName: a.displayName ?? undefined,
  avatarUrl: a.avatarUrl ?? null,
  avatarFrame: a.avatarFrame ?? undefined,
  plus: isPlusActive(a.plusUntil),
});

export function toPublicUser(u: UserLike): PublicUser {
  return {
    id: u._id.toString(),
    username: u.username,
    displayName: u.displayName ?? undefined,
    bio: u.bio ?? "",
    avatarUrl: u.avatarUrl ?? null,
    avatarFrame: u.avatarFrame ?? undefined,
    role: u.role === "admin" ? "admin" : "user",
    plus: isPlusActive(u.plusUntil),
    emailVerified: Boolean(u.emailVerified),
    createdAt: u.createdAt.toISOString(),
  };
}

type UserWithAppearance = UserLike & {
  appearance?: Partial<SiteAppearance> | null;
  shareProfileAppearance?: boolean | null;
  profileAppearanceVisibility?: FriendsVisibility | null;
};

function profileAppearanceVisibility(u: UserWithAppearance): FriendsVisibility {
  return u.profileAppearanceVisibility ?? (u.shareProfileAppearance === false ? "only_me" : "everyone");
}

export function toAccountUser(u: UserWithAppearance): AccountUser {
  const { backgroundUrl, primaryColor, accentColor, font } = u.appearance ?? {};
  return {
    ...toPublicUser(u),
    profileAppearanceVisibility: profileAppearanceVisibility(u),
    appearance: backgroundUrl !== undefined || primaryColor !== undefined || accentColor !== undefined || font !== undefined
      ? { backgroundUrl, primaryColor, accentColor, font }
      : undefined,
  };
}

export function toProfileDTO(
  u: UserWithAppearance,
  counts: { followerCount: number; followingCount: number },
  followedByMe: boolean,
  followsMe: boolean,
): ProfileDTO {
  const { backgroundUrl, primaryColor, accentColor, font } = u.appearance ?? {};
  const visibility = profileAppearanceVisibility(u);
  const shareAppearance = !u.banned &&
    (visibility === "everyone" || (visibility === "friends" && followedByMe && followsMe));
  const profileAppearance = shareAppearance &&
    (backgroundUrl || primaryColor || accentColor || font)
    ? { backgroundUrl, primaryColor, accentColor, font }
    : undefined;
  const publicUser = toPublicUser(u);
  if (!shareAppearance) delete publicUser.avatarFrame;
  return { ...publicUser, ...counts, followedByMe, followsMe, banned: Boolean(u.banned), profileAppearance };
}

/**
 * `unlocked` must be true for the author and for buyers. This is the single place that decides
 * whether premium content leaves the server, so it never defaults to true.
 */
export function toPostDTO(p: PopulatedPost, likedByMe: boolean, unlocked: boolean, online = false): PostDTO {
  const paid = p.priceCents != null;
  const locked = paid && !unlocked;
  return {
    id: p._id.toString(),
    content: p.content,
    imageUrl: p.imageUrl ?? null,
    author: { ...toAuthor(p.author), online },
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    likedByMe,
    community: p.community ? { slug: p.community.slug, name: p.community.name } : null,
    priceCents: p.priceCents ?? null,
    locked,
    premiumContent: paid && !locked ? (p.premiumContent ?? "") : null,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toCommentDTO(c: PopulatedComment): CommentDTO {
  return {
    id: c._id.toString(),
    postId: c.post.toString(),
    content: c.content,
    author: toAuthor(c.author),
    createdAt: c.createdAt.toISOString(),
  };
}

export function toNotificationDTO(n: PopulatedNotification): NotificationDTO {
  return {
    id: n._id.toString(),
    type: n.type,
    actor: { id: n.actor._id.toString(), username: n.actor.username, displayName: n.actor.displayName ?? undefined },
    postId: n.post ? n.post.toString() : null,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

export function toReportDTO(r: PopulatedReport): ReportDTO {
  return {
    id: r._id.toString(),
    reason: r.reason,
    details: r.details ?? "",
    status: r.status,
    reporter: { id: r.reporter._id.toString(), username: r.reporter.username, displayName: r.reporter.displayName ?? undefined },
    post: r.post
      ? {
          id: r.post._id.toString(),
          content: r.post.content,
          imageUrl: r.post.imageUrl ?? null,
          author: toAuthor(r.post.author),
        }
      : null,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}

export interface CommunityLike {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  description?: string | null;
  memberCount: number;
  createdAt: Date;
}

export function toCommunityDTO(c: CommunityLike, myRole: "owner" | "member" | null): CommunityDTO {
  return {
    id: c._id.toString(),
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    memberCount: c.memberCount,
    joinedByMe: myRole !== null,
    myRole,
    createdAt: c.createdAt.toISOString(),
  };
}
