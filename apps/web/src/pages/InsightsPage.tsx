import { Link } from "react-router-dom";
import { CardsSkeleton } from "../components/Skeleton";
import Icon from "../components/Icon";
import { useInsights } from "../hooks/useBilling";
import { useAuth } from "../store/auth";

const nf = new Intl.NumberFormat("ru-RU");

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{nf.format(value)}</strong>
    </div>
  );
}

export default function InsightsPage() {
  const { user } = useAuth();
  const plus = Boolean(user?.plus);
  const insights = useInsights(plus);

  if (!plus) {
    return (
      <section className="card plus-hero">
        <h1>Статистика</h1>
        <p>Смотрите статистику записей: просмотры, отметки «Нравится», комментарии и рост подписчиков.</p>
        <Link className="btn" to="/plus">

          Подключить Bubble Plus
        </Link>
      </section>
    );
  }
  if (insights.isLoading) return <CardsSkeleton count={3} />;
  if (insights.isError || !insights.data) {
    return <p className="error center">{insights.error?.message ?? "Не удалось загрузить статистику."}</p>;
  }

  const { totals, daily, topPosts } = insights.data;
  const max = Math.max(1, ...daily.map((d) => d.views));
  const last30 = daily.reduce((sum, d) => sum + d.views, 0);

  return (
    <>
      <h1 className="search-title">Статистика</h1>
      <div className="stats">
        <Stat label="Записи" value={totals.posts} />
        <Stat label="Просмотры" value={totals.views} />
        <Stat label="Отметки «Нравится»" value={totals.likes} />
        <Stat label="Комментарии" value={totals.comments} />
        <Stat label="Подписчики" value={totals.followers} />
        <Stat label="Новые подписчики за 30 дней" value={totals.newFollowers30d} />
      </div>

      <section className="card">
        <strong>Просмотры за 30 дней</strong>{" "}
        <span className="muted">· {nf.format(last30)}  всего</span>
        <div
          className="bars"
          role="img"
          aria-label={`Просмотры за последние 30 дней, всего ${last30}`}
        >
          {daily.map((d) => (
            <div
              key={d.day}
              className="bar"
              style={{ height: `${Math.max(2, (d.views / max) * 100)}%` }}
              title={`${d.day}: просмотров — ${d.views}`}
            />
          ))}
        </div>
        <p className="muted small">

          Каждый пользователь учитывается один раз на запись в день. Ваши просмотры не учитываются.
        </p>
      </section>

      <section className="card">
        <strong>Популярные записи</strong>
        {topPosts.length === 0 && <p className="muted">Опубликуйте запись, чтобы увидеть её статистику.</p>}
        {topPosts.map((p) => (
          <Link key={p.id} to={`/posts/${p.id}`} className="top-post">
            <span>{p.content || "(запись с изображением)"}</span>
            <span className="muted">
              <span className="metric">
                <Icon name="eye" size={16} /> {nf.format(p.views)}
              </span>{" "}
              <span className="metric">
                <Icon name="heart" size={16} /> {nf.format(p.likes)}
              </span>{" "}
              <span className="metric">
                <Icon name="comment" size={16} /> {nf.format(p.comments)}
              </span>
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
