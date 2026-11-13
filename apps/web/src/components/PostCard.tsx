import { pluralRu } from "../lib/plural";
import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { PostDTO } from "@commune/shared";
import { useAuth } from "../store/auth";
import { useDeletePost, useToggleLike } from "../hooks/usePosts";
import { formatPrice, useCheckout } from "../hooks/usePayments";
import { assetUrl } from "../lib/api";
import { ProfileAvatar } from "./Avatar";
import Icon from "./Icon";
import PlusBadge from "./PlusBadge";
import { hueFor } from "../lib/hue";
import ReportForm from "./ReportForm";
import InlineComments from "./InlineComments";
import MusicAttachments from "./MusicAttachments";

const relativeTime = new Intl.RelativeTimeFormat("ru", { numeric: "always" });
export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return relativeTime.format(-seconds, "second");
  if (seconds < 3600) return relativeTime.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return relativeTime.format(-Math.floor(seconds / 3600), "hour");
  return relativeTime.format(-Math.floor(seconds / 86400), "day");
}

export default function PostCard({ post, inlineComments = false }: { post: PostDTO; inlineComments?: boolean }) {
  const { user } = useAuth();
  const like = useToggleLike();
  const del = useDeletePost();
  const checkout = useCheckout();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsMounted, setCommentsMounted] = useState(false);
  const [reporting, setReporting] = useState(false);
  const mine = user?.id === post.author.id;
  const isAdmin = user?.role === "admin";

  return (
    <article className={`card post post-head${inlineComments ? " feed-post" : ""}`}>
      <ProfileAvatar username={post.author.username} url={post.author.avatarUrl} />
      {!mine && <button type="button" className="btn btn-ghost post-report" title="Пожаловаться" aria-label="Пожаловаться" aria-expanded={reporting} onClick={() => setReporting((r) => !r)}><Icon name="flag" size={18} /></button>}
      {inlineComments && mine && <button type="button" className="btn btn-ghost danger feed-delete" title="Удалить запись" aria-label="Удалить запись" disabled={del.isPending} onClick={() => window.confirm(mine ? "Удалить эту запись?" : "Удалить эту запись как администратор?") && del.mutate(post.id)}><Icon name="trash" size={18} /></button>}
      <div className="post-main">
        <div className="post-meta">
          <Link to={`/u/${post.author.username}`} className="user-link">
            @{post.author.username}
          </Link>
          <PlusBadge plus={post.author.plus} />
          {inlineComments ? (
            <span className="muted">· <Link className="feed-post-time" to={`/posts/${post.id}`} aria-label={`Открыть публикацию @${post.author.username} от ${new Date(post.createdAt).toLocaleString("ru-RU")}`}>
              <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
            </Link></span>
          ) : <span className="muted">· {timeAgo(post.createdAt)}</span>}
          {post.community && (
            <Link
              to={`/c/${post.community.slug}`}
              className="community-tag"
              style={{ "--hue": hueFor(post.community.slug).bg } as CSSProperties}
            >
              c/{post.community.slug}
            </Link>
          )}
          {post.priceCents != null && (
            <span className="price-badge">{formatPrice(post.priceCents)}</span>
          )}
        </div>
        {post.content && <p className="post-body">{post.content}</p>}
        {post.imageUrl && (
          <a href={assetUrl(post.imageUrl)} target="_blank" rel="noopener noreferrer">
            <img
              className="post-image"
              src={assetUrl(post.imageUrl)}
              alt={`Изображение пользователя @${post.author.username}`}
              loading="lazy"
              decoding="async"
            />
          </a>
        )}
        {!post.locked && post.musicAttachments?.length > 0 && <MusicAttachments attachments={post.musicAttachments} source={`post:${post.id}`} />}
        {post.locked && post.priceCents != null && (
          <div className="paywall">
            <p>
              <Icon name="lock" size={16} />  Остальная часть записи доступна после оплаты.
            </p>
            <button
              className="btn"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate(post.id)}
            >
              {checkout.isPending
                ? "Открываем страницу оплаты…"
                : `Открыть за ${formatPrice(post.priceCents)}`}
            </button>
            {checkout.isError && <p className="error">{checkout.error.message}</p>}
          </div>
        )}
        {post.premiumContent && (
          <div className="premium">
            <span className="premium-label">Открытое содержимое</span>
            <p className="post-body">{post.premiumContent}</p>
          </div>
        )}
        <div className="post-actions">
          <button
            className={`btn btn-ghost ${post.likedByMe ? "liked" : ""}`}
            onClick={() => like.mutate(post.id)}
            disabled={like.isPending}
            aria-pressed={post.likedByMe}
          >
            <Icon name="heart" size={19} filled={post.likedByMe} />
            <span>{post.likeCount}</span>
          </button>
          {inlineComments ? <button type="button" className="btn btn-ghost" aria-label={`${post.commentCount} ${pluralRu(post.commentCount, "комментарий", "комментария", "комментариев")}`} aria-expanded={commentsOpen} onClick={() => { setCommentsMounted(true); setCommentsOpen(v => !v); }}><Icon name="comment" size={19} /><span>{post.commentCount}</span></button> : <Link className="btn btn-ghost" to={`/posts/${post.id}`}>
            <Icon name="comment" size={19} />
            <span>{post.commentCount}</span>
          </Link>}
          {(!inlineComments || !mine) && (mine || isAdmin) && (
            <button
              className="btn btn-ghost danger"
              onClick={() =>
                window.confirm(mine ? "Удалить эту запись?" : "Удалить эту запись как администратор?") &&
                del.mutate(post.id)
              }
            >
              <Icon name="trash" size={18} /> {mine ? "Удалить" : "Удалить"}
            </button>
          )}
        </div>
        {inlineComments && (
          <div className={`comments-disclosure${commentsOpen ? " is-open" : ""}`} aria-hidden={!commentsOpen} ref={(node) => { node?.toggleAttribute("inert", !commentsOpen); }}>
            <div className="comments-disclosure-inner">{commentsMounted && <InlineComments postId={post.id} />}</div>
          </div>
        )}
        {reporting && <ReportForm postId={post.id} onClose={() => setReporting(false)} />}
      </div>
    </article>
  );
}
