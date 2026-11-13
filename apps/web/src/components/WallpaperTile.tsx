import type { ReactNode } from "react";

export default function WallpaperTile({
  src,
  label,
  author,
  selected,
  onSelect,
  children,
}: {
  src?: string;
  label: string;
  author?: string;
  selected: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="wallpaper-tile">
      <button
        type="button"
        className="appearance-wallpaper-option"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <img src={src} alt="" loading="lazy" />
        <span className="wallpaper-tile-label" title={label}>
          {label}
        </span>
        {author && <span className="wallpaper-tile-author">{author}</span>}
      </button>
      {children}
    </div>
  );
}
