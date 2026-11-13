import type { WallpaperDTO } from "@commune/shared";
import type { useWallpaperReaction } from "../hooks/useWallpapers";
import Icon from "./Icon";

export default function WallpaperTileActions({
  item,
  reaction,
  onReport,
}: {
  item: WallpaperDTO;
  reaction: ReturnType<typeof useWallpaperReaction>;
  onReport: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <div className="wallpaper-tile-actions">
      <button
        type="button"
        className="wallpaper-like"
        aria-label={`Нравится: ${item.likeCount}`}
        title="Нравится"
        aria-pressed={item.liked}
        disabled={reaction.isPending}
        onClick={() => reaction.mutate({ id: item.id, kind: "like", enabled: !item.liked })}
      >
        <Icon name="heart" size={14} filled={item.liked} />
        <span aria-hidden="true">{item.likeCount}</span>
      </button>
      <button
        type="button"
        className="wallpaper-favorite"
        aria-label="Избранное"
        title="Избранное"
        aria-pressed={item.favorite}
        disabled={reaction.isPending}
        onClick={() =>
          reaction.mutate({
            id: item.id,
            kind: "favorite",
            enabled: !item.favorite,
          })
        }
      >
        <Icon name="star" size={14} filled={item.favorite} />
      </button>
      <button
        type="button"
        aria-label="Пожаловаться на фон"
        title={item.mine ? "Это ваш фон" : "Пожаловаться на фон"}
        disabled={item.mine}
        data-report-id={item.id}
        onClick={(event) => onReport(event.currentTarget)}
      >
        <Icon name="flag" size={14} />
      </button>
    </div>
  );
}
