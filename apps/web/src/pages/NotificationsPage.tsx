import { displayNameOf } from "@commune/shared";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { NotificationDTO } from "@commune/shared";
import { RowsSkeleton } from "../components/Skeleton";
import { timeAgo } from "../components/PostCard";
import { useMarkAllRead, useNotifications } from "../hooks/useSocial";

const TEXT: Record<NotificationDTO["type"], string> = {
  like: "понравилась ваша запись",
  comment: "прокомментировал вашу запись",
  follow: "хочет добавить вас в друзья",
};

export default function NotificationsPage() {
  const list = useNotifications();
  const markRead = useMarkAllRead();
  const { mutate } = markRead;

  // Mark everything read once the list has loaded. The page keeps the original
  // "read" flags, so new items stay highlighted while you are looking at them.
  // A new notification can arrive before the previous read has refreshed the badge.
  // Likes and follows reuse an ID and advance createdAt when they are raised again.
  const unreadVersion = list.data?.filter((n) => !n.read).map((n) => `${n.id}/${n.createdAt}`).join(",");
  useEffect(() => {
    if (unreadVersion) mutate();
  }, [unreadVersion, mutate]);

  return (
    <>
      <h1 className="page-title">Уведомления</h1>
      {list.isLoading && <RowsSkeleton count={5} avatar={36} card />}
      {list.isError && <p className="error center">{list.error.message}</p>}
      {list.isSuccess && list.data.length === 0 && (
        <p className="muted center">Здесь пока пусто. Здесь появятся отметки «Нравится», комментарии и заявки в друзья.</p>
      )}
      {list.data?.map((n) => (
        <Link
          key={n.id}
          to={n.postId ? `/posts/${n.postId}` : `/u/${n.actor.username}`}
          className={`card notification ${n.read ? "" : "unread"}`}
        >
          <span>
            <strong>{displayNameOf(n.actor)}</strong> {TEXT[n.type]}
          </span>
          <span className="muted">{timeAgo(n.createdAt)}</span>
        </Link>
      ))}
    </>
  );
}
