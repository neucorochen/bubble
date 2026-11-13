import { displayNameOf } from "@commune/shared";
import { Link, useSearchParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import PlusBadge from "../components/PlusBadge";
import SearchBox from "../components/SearchBox";
import PostList from "../components/PostList";
import { useSearchPosts, useSearchUsers } from "../hooks/useSearch";

type Tab = "people" | "posts";

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const tab: Tab = params.get("type") === "posts" ? "posts" : "people";
  const users = useSearchUsers(q);
  const posts = useSearchPosts(q);

  const choose = (next: Tab) => setParams({ q, type: next });
  const people = users.data?.pages.flatMap((p) => p.items) ?? [];

  if (q.length < 2) {
    return (
      <>
        <h1 className="search-title">Поиск</h1>
        <SearchBox />
        <p className="muted">Ищите людей и записи. Введите не менее двух символов.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="search-title">Результаты поиска «{q}”</h1>
      <div className="tabs" role="tablist">
        {(["people", "posts"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => choose(t)}
          >
            {t === "people" ? "Люди" : "Записи"}
          </button>
        ))}
      </div>

      {tab === "people" && (
        <>
          {users.isLoading && <p className="muted center">Поиск…</p>}
          {users.isError && <p className="error center">{users.error.message}</p>}
          {users.isSuccess && people.length === 0 && (
            <p className="muted center">Пользователи не найдены. Поиск выполняется по началу имени пользователя.</p>
          )}
          {people.map((u) => (
            <Link key={u.id} to={`/u/${u.username}`} className="card person">
              <Avatar username={u.username} displayName={u.displayName} url={u.avatarUrl} frame={u.avatarFrame} size={44} />
              <div>
                <strong>{displayNameOf(u)}</strong> <PlusBadge plus={u.plus} />
                {u.bio && <p className="muted">{u.bio}</p>}
              </div>
            </Link>
          ))}
          {users.hasNextPage && (
            <button
              className="btn btn-ghost block"
              onClick={() => void users.fetchNextPage()}
              disabled={users.isFetchingNextPage}
            >
              {users.isFetchingNextPage ? "Загрузка…" : "Загрузить ещё"}
            </button>
          )}
        </>
      )}

      {tab === "posts" && <PostList query={posts} emptyMessage="По этому запросу записи не найдены." />}
    </>
  );
}
