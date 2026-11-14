import { displayNameOf } from "@commune/shared";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import type { ReportDTO, ReportStatus } from "@commune/shared";
import Avatar from "../components/Avatar";
import { timeAgo } from "../components/PostCard";
import { REASON_LABELS } from "../components/ReportForm";
import { useErrorEvents, useResolveError } from "../hooks/useErrors";
import { useAdminReports, useDismissReport, useResolveReport } from "../hooks/useModeration";
import { assetUrl } from "../lib/api";
import { useAuth } from "../store/auth";

const TABS: Array<{ id: ReportStatus; label: string }> = [
  { id: "open", label: "Открытые" },
  { id: "resolved", label: "Решённые" },
  { id: "dismissed", label: "Отклонённые" },
];

function ReportItem({ report, actionable }: { report: ReportDTO; actionable: boolean }) {
  const dismiss = useDismissReport();
  const resolve = useResolveReport();
  const busy = dismiss.isPending || resolve.isPending;
  const error = dismiss.error ?? resolve.error;

  const removePost = () => {
    if (window.confirm("Удалить эту запись?")) {
      resolve.mutate({ id: report.id, action: "remove_post" });
    }
  };
  const removeAndSuspend = () => {
    if (
      report.post &&
      window.confirm(`Удалить запись и заблокировать ${displayNameOf(report.post.author)}?`)
    ) {
      resolve.mutate({ id: report.id, action: "remove_post_and_ban" });
    }
  };

  return (
    <article className="card report">
      <div className="report-head">
        <strong>{REASON_LABELS[report.reason]}</strong>
        <span className="muted">

          пожаловался {displayNameOf(report.reporter)} · {timeAgo(report.createdAt)}
        </span>
      </div>
      {report.details && <p className="report-details">“{report.details}”</p>}

      {report.post ? (
        <div className="report-post post-head">
          <Avatar
            username={report.post.author.username} displayName={report.post.author.displayName}
            url={report.post.author.avatarUrl} frame={report.post.author.avatarFrame}
            size={32}
          />
          <div className="post-main">
            <strong>{displayNameOf(report.post.author)}</strong>
            {report.post.content && <p className="post-body">{report.post.content}</p>}
            {report.post.imageUrl && (
              <img
                className="post-image"
                src={assetUrl(report.post.imageUrl)}
                alt="Вложение в жалобе"
                loading="lazy"
              />
            )}
          </div>
        </div>
      ) : (
        <p className="muted">Эта запись уже удалена.</p>
      )}

      {actionable && (
        <div className="row report-actions">
          <button
            className="btn btn-outline"
            onClick={() => dismiss.mutate(report.id)}
            disabled={busy}
          >

            Отклонить
          </button>
          {report.post && (
            <>
              <button className="btn btn-outline" onClick={removePost} disabled={busy}>

                Удалить запись
              </button>
              <button className="btn btn-danger" onClick={removeAndSuspend} disabled={busy}>

                Удалить запись и заблокировать автора
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="error">{error.message}</p>}
    </article>
  );
}

function ErrorsPanel() {
  const errors = useErrorEvents(true);
  const resolve = useResolveError();
  const items = errors.data ?? [];
  return (
    <>
      {errors.isLoading && <p className="muted center">Загрузка…</p>}
      {errors.isError && <p className="error center">{errors.error.message}</p>}
      {errors.isSuccess && items.length === 0 && (
        <p className="muted center">Активных ошибок нет.</p>
      )}
      {items.map((e) => (
        <article key={e.id} className="card report">
          <div className="report-head">
            <strong>{e.message}</strong>
            <span className="muted">
              {e.source === "web" ? "Браузер" : "API"} · {e.count}× · {timeAgo(e.lastSeen)}
            </span>
          </div>
          <p className="muted">{e.route}</p>
          {e.stack && (
            <details>
              <summary className="muted">Трассировка ошибки</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, overflowWrap: "anywhere" }}>
                {e.stack}
              </pre>
            </details>
          )}
          <div className="row report-actions">
            <button
              className="btn btn-outline"
              onClick={() => resolve.mutate(e.id)}
              disabled={resolve.isPending}
            >

              Отметить исправленной
            </button>
          </div>
        </article>
      ))}
    </>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"reports" | "errors">("reports");
  const [status, setStatus] = useState<ReportStatus>("open");
  const reports = useAdminReports(status);

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  const items = reports.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <h1 className="page-title">Администрирование</h1>
      <div className="tabs" role="tablist" aria-label="Разделы администрирования">
        <button
          role="tab"
          aria-selected={view === "reports"}
          className={`tab ${view === "reports" ? "active" : ""}`}
          onClick={() => setView("reports")}
        >

          Модерация
        </button>
        <button
          role="tab"
          aria-selected={view === "errors"}
          className={`tab ${view === "errors" ? "active" : ""}`}
          onClick={() => setView("errors")}
        >

          Ошибки
        </button>
      </div>
      {view === "errors" ? (
        <ErrorsPanel />
      ) : (
        <>
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === status}
                className={`tab ${t.id === status ? "active" : ""}`}
                onClick={() => setStatus(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {reports.isLoading && <p className="muted center">Загрузка…</p>}
          {reports.isError && <p className="error center">{reports.error.message}</p>}
          {reports.isSuccess && items.length === 0 && (
            <p className="muted center">
              {status === "open" ? "Открытых жалоб нет." : "Здесь пока пусто."}
            </p>
          )}
          {items.map((r) => (
            <ReportItem key={r.id} report={r} actionable={status === "open"} />
          ))}
          {reports.hasNextPage && (
            <button
              className="btn btn-ghost block"
              onClick={() => void reports.fetchNextPage()}
              disabled={reports.isFetchingNextPage}
            >
              {reports.isFetchingNextPage ? "Загрузка…" : "Загрузить ещё"}
            </button>
          )}
        </>
      )}
    </>
  );
}
