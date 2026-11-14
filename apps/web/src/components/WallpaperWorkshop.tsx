import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WALLPAPER_NAME_MAX_LENGTH, type WallpaperDTO, type WallpaperView } from "@commune/shared";
import { useWallpaperReaction, useWallpapers } from "../hooks/useWallpapers";
import WallpaperUploadDialog from "./WallpaperUploadDialog";
import { assetUrl } from "../lib/api";
import WallpaperTileActions from "./WallpaperTileActions";
import AeroTitlebar from "./AeroTitlebar";
import WallpaperPagination from "./WallpaperPagination";
import WallpaperReport from "./WallpaperReport";
import WallpaperTile from "./WallpaperTile";

type WorkshopView = Exclude<WallpaperView, "favorites">;

export default function WallpaperWorkshop({
  userId,
  selected,
  onSelect,
  onClose,
}: {
  userId: string;
  selected?: string | null;
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<WorkshopView>("popular");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const uploadTrigger = useRef<HTMLButtonElement>(null);
  const [reportTarget, setReportTarget] = useState<WallpaperDTO>();
  const reportTriggerId = useRef<string>();
  const query = useWallpapers(userId, view, searchQuery);
  const queryClient = useQueryClient();
  const key = ["wallpapers", userId];
  const reaction = useWallpaperReaction(userId);

  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (reportTarget) {
      dialog.current
        ?.querySelector<HTMLSelectElement>("form select")
        ?.focus({ preventScroll: true });
    } else if (reportTriggerId.current) {
      dialog.current
        ?.querySelector<HTMLButtonElement>(`[data-report-id="${reportTriggerId.current}"]`)
        ?.focus();
      reportTriggerId.current = undefined;
    }
  }, [reportTarget]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  function closeUpload() {
    setUploadOpen(false);
    requestAnimationFrame(() => uploadTrigger.current?.focus({ preventScroll: true }));
  }

  const { items, page } = query;
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [page, view, searchQuery]);

  return (
    <>
      <dialog
        ref={dialog}
        className="wallpaper-workshop"
        aria-labelledby="workshop-title"
        onCancel={(event) => {
          event.preventDefault();
          if (reportTarget) setReportTarget(undefined);
          else onClose();
        }}
      >
        <div className="wallpaper-workshop-window">
          <AeroTitlebar onClose={onClose}>
            <h2 id="workshop-title">Мастерская фонов</h2>
          </AeroTitlebar>
          <div ref={body} className="wallpaper-workshop-body">
            {reportTarget ? (
              <WallpaperReport
                key={reportTarget.id}
                item={reportTarget}
                onClose={() => setReportTarget(undefined)}
              />
            ) : (
              <>
                <div className="wallpaper-workshop-toolbar">
                  <input
                    type="search"
                    aria-label="Поиск по названию"
                    placeholder="Поиск по названию"
                    value={search}
                    maxLength={WALLPAPER_NAME_MAX_LENGTH}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <select
                    aria-label="Сортировка фонов"
                    value={view}
                    onChange={(event) => {
                      setView(event.target.value as WorkshopView);
                      reaction.reset();
                    }}
                  >
                    <option value="popular">Популярное</option>
                    <option value="new">Новые</option>
                    <option value="friends">У друзей</option>
                  </select>
                  <button
                    ref={uploadTrigger}
                    type="button"
                    className="btn wallpaper-upload-trigger"
                    aria-haspopup="dialog"
                    onClick={() => {
                      setPublished(false);
                      setUploadOpen(true);
                    }}
                  >
                    Загрузить фон
                  </button>
                </div>
                {published && <p role="status">Фон опубликован</p>}
                {reaction.error && (
                  <p role="alert" className="error">
                    {reaction.error.message}
                  </p>
                )}
                {(query.isPending || query.isPlaceholderData) && (
                  <p role="status">Загружаем фоны…</p>
                )}
                {query.isError && (
                  <div className="row">
                    <p role="alert">{query.error.message}</p>
                    <button type="button" className="btn" onClick={() => void query.refetch()}>
                      Повторить
                    </button>
                  </div>
                )}
                {query.isSuccess && !query.isPlaceholderData && !items.length && (
                  <p>
                    {searchQuery
                      ? "Фоны с таким названием не найдены."
                      : view === "friends"
                        ? "У друзей пока нет фонов из мастерской."
                        : "В мастерской пока нет фонов."}
                  </p>
                )}
                <div className="wallpaper-grid">
                  {items.map((item) => (
                    <WallpaperTile
                      key={item.id}
                      src={assetUrl(item.imageUrl)}
                      label={item.name}
                      author={item.author}
                      selected={item.imageUrl === selected}
                      onSelect={() => onSelect(item.imageUrl)}
                    >
                      <WallpaperTileActions
                        item={item}
                        reaction={reaction}
                        onReport={() => {
                          reportTriggerId.current = item.id;
                          setReportTarget(item);
                        }}
                      />
                      {item.usedByFriends && (
                        <span className="wallpaper-friend-label">У друзей сейчас</span>
                      )}
                    </WallpaperTile>
                  ))}
                </div>
              </>
            )}
          </div>
          {!reportTarget && <WallpaperPagination query={query} label="Страницы каталога фонов" />}
        </div>
      </dialog>
      {uploadOpen && (
        <WallpaperUploadDialog
          onClose={closeUpload}
          onPublish={() => {
            setSearch("");
            setSearchQuery("");
            setView("new");
            query.goToPage(1);
            setPublished(true);
            closeUpload();
            void queryClient.invalidateQueries({ queryKey: key });
          }}
        />
      )}
    </>
  );
}
