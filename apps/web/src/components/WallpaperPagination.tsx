import Icon from "./Icon";
import type { useWallpapers } from "../hooks/useWallpapers";

export default function WallpaperPagination({
  query,
  label,
}: {
  query: ReturnType<typeof useWallpapers>;
  label: string;
}) {
  const { page, totalPages, goToPage } = query;
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);
  const numbers = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);

  return (
    <nav className="wallpaper-pagination" aria-label={label}>
      <button
        type="button"
        aria-label="Предыдущая страница"
        disabled={page <= 1}
        onClick={() => goToPage(page - 1)}
      >
        <Icon name="back" size={14} />
      </button>
      {start > 1 && <span aria-hidden="true">…</span>}
      {numbers.map((number) => (
        <button
          key={number}
          type="button"
          aria-label={`Страница ${number}`}
          aria-current={page === number ? "page" : undefined}
          onClick={() => goToPage(number)}
        >
          {number}
        </button>
      ))}
      {end < totalPages && <span aria-hidden="true">…</span>}
      <button
        type="button"
        aria-label="Следующая страница"
        disabled={page >= totalPages}
        onClick={() => goToPage(page + 1)}
      >
        <Icon name="back" size={14} style={{ transform: "rotate(180deg)" }} />
      </button>
    </nav>
  );
}
