import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { MusicTrackDTO } from "@commune/shared";
import { api, withQuery } from "../lib/api";
import { useAuth } from "../store/auth";
import MusicTrackList from "./MusicTrackList";
import { useMusicPlayer } from "../store/music";

export default function MusicAttachmentPicker({
  selected,
  onChange,
  onClose,
}: {
  selected: MusicTrackDTO[];
  onChange: (tracks: MusicTrackDTO[]) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closePicker = () => {
    if (dialog.current?.contains(document.activeElement) && previousFocus.current?.isConnected) previousFocus.current.focus();
    onClose();
  };
  const onCloseRef = useRef(closePicker);
  onCloseRef.current = closePicker;
  const [scope, setScope] = useState<"all" | "mine">("mine");
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { track: playingTrack } = useMusicPlayer();
  const query = useInfiniteQuery({
    queryKey: ["music-picker", user?.id, scope, search],
    gcTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<{ tracks: MusicTrackDTO[]; nextCursor: string | null }>(
        withQuery("/music/picker", { scope, q: search.trim() || undefined, cursor: pageParam }),
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLInputElement>("input[type=search]")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog:modal")) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  const tracks = query.data?.pages.flatMap((page) => page.tracks) ?? [];
  const portalTarget = document.querySelector(".aero-home .aero-window");
  if (!portalTarget) return null;
  return createPortal(
    <dialog
      ref={dialog}
      open
      className={`music-attachment-picker${playingTrack ? " music-attachment-picker--with-player" : ""}`}
      aria-labelledby="music-picker-title"
      onKeyDown={(event) => { if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault(); }}
    >
      <header className="music-attachment-picker__header">
        <h2 id="music-picker-title">Выбрать музыку</h2>
        <span className="aero-window-controls music-player__window-controls"><span className="aero-window-close"><button type="button" className="music-player__close" aria-label="Закрыть" title="Закрыть" onClick={closePicker}><i className="aero-control-close" aria-hidden="true" /></button></span></span>
      </header>
      <div className="music-attachment-picker__body">
        <input
          className="aero-input music-attachment-picker__search"
          type="search"
          aria-label="Поиск музыки"
          placeholder="Название или исполнитель"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="tabs feed-tabs music-picker-tabs" role="group" aria-label="Источник музыки">
          <button
            type="button"
            className={`tab ${scope === "mine" ? "active" : ""}`}
            aria-pressed={scope === "mine"}
            onClick={() => setScope("mine")}
          >
            Моя библиотека
          </button>
          <button
            type="button"
            className={`tab ${scope === "all" ? "active" : ""}`}
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
          >
            Вся музыка
          </button>
        </div>
        <p aria-live="polite">Выбрано {selected.length}/10</p>
        <div className="music-attachment-picker__scroll" tabIndex={0} aria-label="Список музыки">
        {query.isLoading && <p>Загрузка музыки...</p>}
        {query.isError && (
          <p role="alert">
            Не удалось загрузить музыку.{" "}
            <button type="button" className="btn btn-ghost" onClick={() => void query.refetch()}>
              Повторить
            </button>
          </p>
        )}
        {query.isSuccess && !tracks.length && <p>Ничего не найдено.</p>}
        <div className="music-attachment-picker__list">
          <MusicTrackList tracks={tracks} source={`picker:${user?.id}:${scope}`} selection={{ selected, onChange }} />
        </div>
        {query.hasNextPage && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Показать ещё
          </button>
        )}
        </div>
        <button type="button" className="aero-button" onClick={closePicker}>
          Готово
        </button>
      </div>
    </dialog>, portalTarget,
  );
}
