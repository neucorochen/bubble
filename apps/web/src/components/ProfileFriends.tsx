import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import { useFriends, useFriendsAccess } from "../hooks/useSocial";
import { ApiError } from "../lib/api";

export default function ProfileFriends({ username, isMe }: { username: string; isMe: boolean }) {
  const access = useFriendsAccess(username);
  const allowed = Boolean(
    access.isFetchedAfterMount && !access.isFetching && !access.isError && access.data?.canView,
  );
  const friends = useFriends(username, "", allowed, 6);
  const denied = friends.error instanceof ApiError && friends.error.status === 403;
  if (access.isFetching) return <p className="muted">Загрузка друзей…</p>;
  if (access.isError)
    return (
      <p className="error">
        Не удалось загрузить друзей.{" "}
        <button type="button" className="btn btn-ghost" onClick={() => void access.refetch()}>
          Повторить
        </button>
      </p>
    );
  if (!allowed || !access.data?.canView || denied) return null;
  const people = friends.data?.pages[0]?.items ?? [];
  return (
    <section className="profile-friends-preview" aria-label="Друзья">
      <Link
        className="profile-friends-heading"
        to={isMe ? "/friends" : `/friends/${encodeURIComponent(username)}`}
      >
        Друзья: {access.data.count}
      </Link>
      {friends.isLoading && <p className="muted">Загрузка…</p>}
      {friends.isError && !denied && (
        <p className="error">
          Не удалось загрузить друзей.{" "}
          <button type="button" className="btn btn-ghost" onClick={() => void friends.refetch()}>
            Повторить
          </button>
        </p>
      )}
      {people.length > 0 && (
        <div className="friends-preview-grid">
          {people.map((person) => (
            <Link
              className="friend-preview"
              key={person.id}
              to={`/u/${encodeURIComponent(person.username)}`}
            >
              <Avatar username={person.username} url={person.avatarUrl} size={48} />
              <span>@{person.username}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
