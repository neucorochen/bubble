import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { NotificationDTO } from "@commune/shared";
import PushSettings from "../components/PushSettings";
import SoundSettings from "../components/SoundSettings";
import { RowsSkeleton } from "../components/Skeleton";
import { timeAgo } from "../components/PostCard";
import { useMarkAllRead, useNotifications } from "../hooks/useSocial";

const TEXT: Record<NotificationDTO["type"], string> = {
  like: "понравилась ваша запись",
  comment: "прокомментировал вашу запись",
  follow: "подписался на вас",
};

export default function NotificationsPage() {
  const list = useNotifications();
  const markRead = useMarkAllRead();
  const { mutate } = markRead;

  // Mark everything read once the list has loaded. The page keeps the original
  // "read" flags, so new items stay highlighted while you are looking at them.
  const hasUnread = list.data?.some((n) => !n.read) ?? false;
  useEffect(() => {
    if (hasUnread) mutate();
  }, [hasUnread, mutate]);

  return (
    <>
      <h1 className="page-title">Уведомления</h1>
      <SoundSettings />
      <PushSettings />
      {list.isLoading && <RowsSkeleton count={5} avatar={36} card />}
      {list.isError && <p className="error center">{list.error.message}</p>}
      {list.isSuccess && list.data.length === 0 && (
        <p className="muted center">Здесь пока пусто. Здесь появятся отметки «Нравится», комментарии и новые подписчики.</p>
      )}
      {list.data?.map((n) => (
        <Link
          key={n.id}
          to={n.postId ? `/posts/${n.postId}` : `/u/${n.actor.username}`}
          className={`card notification ${n.read ? "" : "unread"}`}
        >
          <span>
            <strong>@{n.actor.username}</strong> {TEXT[n.type]}
          </span>
          <span className="muted">{timeAgo(n.createdAt)}</span>
        </Link>
      ))}
    </>
  );
}
