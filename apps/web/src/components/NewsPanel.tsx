import { Link } from "react-router-dom";
import { useNews } from "../hooks/useNews";
import { timeAgo } from "./PostCard";
import { NewsPanelSkeleton } from "./Skeleton";

/** "What's happening": live headlines. Every item opens the publisher's own page. */
export default function NewsPanel({ limit = 4 }: { limit?: number }) {
  const news = useNews("top");

  return (
    <section className="card news-panel" aria-label="Последние новости">
      <div className="news-head">
        <strong>Что происходит</strong>
        <span className="live-dot" title="Обновляется автоматически">

          Сейчас
        </span>
      </div>

      {news.isLoading && <NewsPanelSkeleton count={limit} />}

      {news.isError && (
        <p className="muted small">

          Новости сейчас недоступны.{" "}
          <button className="link-btn" onClick={() => void news.refetch()}>

            Попробовать снова
          </button>
        </p>
      )}

      {news.data?.slice(0, limit).map((n) => (
        <a
          key={n.id}
          className="news-item"
          href={n.link}
          target="_blank"
          rel="noopener noreferrer nofollow"
        >
          <span className="muted small">
            {n.source} · {timeAgo(n.publishedAt)}
          </span>
          <span className="news-title">{n.title}</span>
        </a>
      ))}

      <Link to="/news" className="news-more">

        Показать ещё
      </Link>
    </section>
  );
}
