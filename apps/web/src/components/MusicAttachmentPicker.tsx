import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { MusicTrackDTO } from "@commune/shared";
import { api, withQuery } from "../lib/api";
import { useAuth } from "../store/auth";
import MusicTrackList from "./MusicTrackList";

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
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [search, setSearch] = useState("");
  const { user } = useAuth();
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
    dialog.current?.showModal();
  }, []);
  const tracks = query.data?.pages.flatMap((page) => page.tracks) ?? [];
  return (
    <dialog
      ref={dialog}
      className="aero-panel music-attachment-picker"
      aria-labelledby="music-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="music-page__upload-header">
        <h2 id="music-picker-title">Выбрать музыку</h2>
        <button type="button" className="aero-button" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
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
            className={`tab ${scope === "all" ? "active" : ""}`}
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
          >
            Вся музыка
          </button>
          <button
            type="button"
            className={`tab ${scope === "mine" ? "active" : ""}`}
            aria-pressed={scope === "mine"}
            onClick={() => setScope("mine")}
          >
            Моя библиотека
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
        <button type="button" className="aero-button" onClick={onClose}>
          Готово
        </button>
      </div>
    </dialog>
  );
}
