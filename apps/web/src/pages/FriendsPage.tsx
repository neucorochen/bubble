import { useProfile } from "../hooks/useSocial";
import { displayNameOf } from "@commune/shared";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { UserSummaryDTO } from "@commune/shared";
import Avatar from "../components/Avatar";
import PlusBadge from "../components/PlusBadge";
import {
  useFriendRequests,
  useFriends,
  useFriendsAccess,
  useToggleFollow,
  useRelationshipCounts,
} from "../hooks/useSocial";
import { useAuth } from "../store/auth";
import { ApiError } from "../lib/api";

type Tab = "friends" | "outgoing" | "incoming";
const tabs: { id: Tab; label: string; empty: string }[] = [
  { id: "friends", label: "Друзья", empty: "Друзей пока нет." },
  { id: "outgoing", label: "Исходящие заявки", empty: "Исходящих заявок нет." },
  { id: "incoming", label: "Входящие заявки", empty: "Входящих заявок нет." },
];

function PersonRow({ person, tab, isMe }: { person: UserSummaryDTO; tab: Tab; isMe: boolean }) {
  const follow = useToggleFollow(person.username);
  const action =
    tab === "incoming"
      ? "Добавить в ответ"
      : tab === "outgoing"
        ? "Отменить заявку"
        : "Удалить из друзей";
  return (
    <div className="card person friend-list-row">
      <Link className="friend-person-link" to={`/u/${encodeURIComponent(person.username)}`}>
        <Avatar username={person.username} displayName={person.displayName} url={person.avatarUrl} frame={person.avatarFrame} size={44} />
        <strong>{displayNameOf(person)}</strong>
        <PlusBadge plus={person.plus} />
      </Link>
      {isMe && (
        <div>
          <button
            type="button"
            className="btn btn-outline"
            disabled={follow.isPending}
            onClick={() => {
              if (
                tab === "friends" &&
                !window.confirm("Удалить пользователя из друзей? Вы отпишетесь от него.")
              )
                return;
              follow.mutate(tab === "incoming");
            }}
          >
            {action}
          </button>
          {follow.isError && <p className="error">{follow.error.message}</p>}
        </div>
      )}
    </div>
  );
}

export default function FriendsPage() {
  const { username: param } = useParams();
  const { user } = useAuth();
  const username = param ?? user?.username ?? "";
  const isMe = username.toLowerCase() === user?.username.toLowerCase();
  const { data: owner } = useProfile(username, !isMe && Boolean(username));
  const [tab, setTab] = useState<Tab>("friends");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);
  useEffect(() => {
    setTab("friends");
    setInput("");
    setQ("");
  }, [username]);
  const access = useFriendsAccess(username);
  const canView = Boolean(
    access.isFetchedAfterMount && !access.isFetching && !access.isError && access.data?.canView,
  );
  const friends = useFriends(username, q, tab === "friends" && canView);
  const outgoing = useFriendRequests("outgoing", q, isMe && tab === "outgoing");
  const incoming = useFriendRequests("incoming", q, isMe && tab === "incoming");
  const counts = useRelationshipCounts(isMe);
  const qc = useQueryClient();
  const previousCounts = useRef<string | null>(null);
  useEffect(() => {
    if (!isMe || !counts.data || !user) { previousCounts.current = null; return; }
    const current = JSON.stringify(counts.data);
    if (previousCounts.current !== null && previousCounts.current !== current) {
      for (const key of [["friends-access"], ["friends-list"], ["profile"], ["relationships", user.id, "incoming"], ["relationships", user.id, "outgoing"]]) void qc.invalidateQueries({ queryKey: key });
    }
    previousCounts.current = current;
  }, [counts.data, isMe, user, qc]);
  const activeTab = isMe ? tab : "friends";
  const query = activeTab === "friends" ? friends : activeTab === "outgoing" ? outgoing : incoming;
  const denied = friends.error instanceof ApiError && friends.error.status === 403;
  const showList = activeTab !== "friends" || (canView && !denied);
  const people = query.data?.pages.flatMap((page) => page.items) ?? [];
  const empty = tabs.find((item) => item.id === activeTab)?.empty;
  return (
    <>
      <h1 className="page-title">{owner ? `Друзья · ${displayNameOf(owner)}` : "Друзья"}</h1>
      {isMe && (
        <div className="tabs feed-tabs friends-tabs" aria-label="Разделы друзей">
          {tabs.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`tab ${activeTab === item.id ? "active" : ""}`}
              aria-pressed={activeTab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label} ({counts.isFetching || counts.isPending ? "…" : counts.isError ? "—" : counts.data[item.id]})
            </button>
          ))}
        </div>
      )}
      <section className="card friends-page">
        {isMe && counts.isError && <p className="error">Не удалось загрузить количества. <button type="button" className="btn btn-ghost" onClick={() => void counts.refetch()}>Повторить</button></p>}
        {activeTab === "friends" && access.isFetching && (
          <p className="muted" role="status">
            Загрузка…
          </p>
        )}
        {activeTab === "friends" && access.isError && (
          <p className="error">
            {access.error.message}{" "}
            <button type="button" className="btn btn-outline" onClick={() => void access.refetch()}>
              Повторить
            </button>
          </p>
        )}
        {activeTab === "friends" &&
          !access.isFetching &&
          access.data &&
          (!access.data.canView || denied) && (
            <p className="muted">Список друзей скрыт настройками приватности.</p>
          )}
        {showList && (
          <>
            <label className="friends-search">
              Поиск{" "}
              <input
                type="search"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={50}
                placeholder="Имя пользователя"
              />
            </label>
            {query.isLoading && (
              <p className="muted" role="status">
                Загрузка…
              </p>
            )}
            {query.isError && !query.isFetchNextPageError && (
              <p className="error">
                {query.error.message}{" "}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => void query.refetch()}
                >
                  Повторить
                </button>
              </p>
            )}
            {query.isSuccess && people.length === 0 && (
              <p className="muted">{q ? "По вашему запросу ничего не найдено." : empty}</p>
            )}
            {people.map((person) => (
              <PersonRow key={person.id} person={person} tab={activeTab} isMe={isMe} />
            ))}
            {query.isFetchNextPageError && <p className="error">{query.error.message}</p>}
            {query.hasNextPage && (
              <button
                type="button"
                className="btn btn-ghost block"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage
                  ? "Загрузка…"
                  : query.isFetchNextPageError
                    ? "Повторить загрузку"
                    : "Показать ещё"}
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
