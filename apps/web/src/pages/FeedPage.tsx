import { useState } from "react";
import Composer from "../components/Composer";
import PostList from "../components/PostList";
import { useFeed } from "../hooks/usePosts";
import type { FeedType } from "../hooks/usePosts";

const TABS: Array<{ id: FeedType; label: string; empty: string }> = [
  {
    id: "following",
    label: "Подписки",
    empty: "Здесь пока пусто. Подпишитесь на пользователей в их профилях.",
  },
  { id: "all", label: "Все записи", empty: "Записей пока нет. Напишите первую!" },
];

export default function FeedPage() {
  const [tab, setTab] = useState<FeedType>("following");
  const feed = useFeed(tab);
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <Composer allowPaid={false} />
      <div className="tabs feed-tabs" role="tablist" aria-label="Лента">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            className={`tab ${t.id === tab ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <PostList inlineComments query={feed} emptyMessage={active.empty} />
    </>
  );
}
