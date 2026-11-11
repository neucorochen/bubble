import { useState } from "react";
import { NewsCardsSkeleton } from "../components/Skeleton";
import { NEWS_TOPICS, type NewsTopic } from "@commune/shared";
import { useNews } from "../hooks/useNews";
import { timeAgo } from "../components/PostCard";

const LABELS: Record<NewsTopic, string> = {
  top: "Главное",
  world: "Мир",
  technology: "Технологии",
  business: "Бизнес",
  sport: "Спорт",
};

export default function NewsPage() {
  const [topic, setTopic] = useState<NewsTopic>("top");
  const news = useNews(topic);

  return (
    <>
      <h1 className="search-title">Последние новости</h1>
      <div className="tabs" role="tablist" aria-label="Темы новостей">
        {NEWS_TOPICS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={topic === t}
            className={`tab${topic === t ? " active" : ""}`}
            onClick={() => setTopic(t)}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>

      {news.isLoading && <NewsCardsSkeleton />}
      {news.isError && (
        <p className="error center">

          Новости сейчас недоступны.{" "}
          <button className="link-btn" onClick={() => void news.refetch()}>

            Попробовать снова
          </button>
        </p>
      )}
      {news.data?.map((n) => (
        <a
          key={n.id}
          className="card news-card"
          href={n.link}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <span className="muted small">
            {n.source} · {timeAgo(n.publishedAt)}
          </span>
          <strong>{n.title}</strong>
        </a>
      ))}
      <p className="muted small center">

        Заголовки BBC, NPR, The Guardian и Al Jazeera. Ссылки открывают сайты изданий.
      </p>
    </>
  );
}
