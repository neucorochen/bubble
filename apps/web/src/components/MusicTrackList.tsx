import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MusicTrackDTO } from "@commune/shared";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { useMusicPlayer } from "../store/music";
import Icon from "./Icon";

export default function MusicTrackList({ tracks, source, order, selection }: { tracks: MusicTrackDTO[]; source: string; order?: string[]; selection?: { selected: MusicTrackDTO[]; onChange: (tracks: MusicTrackDTO[]) => void } }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const libraryBusy = useIsMutating({ mutationKey: ["music-library", user?.id] }) > 0;
  const { track: current, queueSource, isPlaying, playTrack, togglePlayback, setCurrentQueue } = useMusicPlayer();
  const ids = [...new Set(tracks.map((track) => track.id))].sort();
  const statuses = useQuery({
    queryKey: ["music", "statuses", user?.id, ids],
    enabled: Boolean(user && ids.length),
    queryFn: async () => {
      const batches = [];
      for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
      const responses = await Promise.all(batches.map((batch) => api<{ ids: string[] }>("/music/library/status", { method: "POST", body: { ids: batch } })));
      return responses.flatMap((response) => response.ids);
    },
  });
  const library = useMutation({
    mutationKey: ["music-library", user?.id],
    mutationFn: ({ id, added }: { id: string; added: boolean }) => api<void>(`/music/${id}/library`, { method: added ? "DELETE" : "POST" }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["music"] }),
        qc.invalidateQueries({ queryKey: ["profile-music"] }),
        qc.invalidateQueries({ queryKey: ["music-picker"] }),
      ]);
    },
  });
  const download = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/music/${id}/download`),
    onSuccess: ({ url }) => window.location.assign(url),
  });
  const toggle = (track: MusicTrackDTO) => {
    if (current?.id !== track.id) void playTrack(track, tracks, source);
    else if (queueSource !== source) {
      setCurrentQueue(tracks, source);
      if (!isPlaying) void togglePlayback();
    } else void togglePlayback();
  };
  return <>
    {(order ?? tracks.map((track) => track.id)).map((id) => {
      const track = tracks.find((item) => item.id === id);
      if (!track) return <div className="card music-page__track muted" key={id}>Трек недоступен</div>;
      const selected = current?.id === track.id && queueSource === source;
      const playing = selected && isPlaying;
      const added = statuses.data?.includes(track.id);
      const checked = selection?.selected.some((item) => item.id === track.id) ?? false;
      return <article className={`card music-page__track${selected ? " music-page__track--playing" : ""}`} key={track.id}>
        {selection && <input className="music-attachment-picker__checkbox" type="checkbox" checked={checked} disabled={!checked && selection.selected.length >= 10} aria-label={`Выбрать ${track.artist} — ${track.title}`} onChange={() => selection.onChange(checked ? selection.selected.filter((item) => item.id !== track.id) : [...selection.selected, track])} />}
        <button type="button" className="music-page__play" onClick={() => toggle(track)} aria-label={`${playing ? "Пауза" : "Воспроизвести"} ${track.title}`} title={playing ? "Пауза" : "Воспроизвести"}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d={playing ? "M4 3h3v10H4zM9 3h3v10H9z" : "M3 2v12l10-6z"} fill="currentColor" /></svg>
        </button>
        <button type="button" className="music-page__track-title" title={`${track.artist} — ${track.title}`} disabled={Boolean(selection && !checked && selection.selected.length >= 10)} onClick={() => selection ? selection.onChange(checked ? selection.selected.filter((item) => item.id !== track.id) : [...selection.selected, track]) : toggle(track)}>{track.artist} — {track.title}</button>
        <span className="muted music-page__track-duration" aria-label={track.duration == null ? "Длительность неизвестна" : undefined} title="Длительность трека">{track.duration == null ? "—" : `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, "0")}`}</span>
        {user && <>
          <button type="button" className="btn btn-ghost music-page__library-button" aria-label={`Скачать ${track.title}`} title="Скачать трек" disabled={download.isPending} onClick={() => download.mutate(track.id)}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" /></svg></button>
          <button type="button" className="btn btn-ghost music-page__library-button" aria-label={!statuses.data ? "Проверка библиотеки" : added ? "Убрать из библиотеки" : "Добавить в библиотеку"} title={!statuses.data ? "Проверка библиотеки" : added ? "Убрать из библиотеки" : "Добавить в библиотеку"} disabled={!statuses.data || statuses.isFetching || libraryBusy} onClick={() => library.mutate({ id: track.id, added: Boolean(added) })}>{statuses.data && <Icon name={added ? "trash" : "plus"} size={added ? 16 : 20} />}</button>
        </>}
      </article>;
    })}
    {statuses.isError && <p className="error" role="alert">Не удалось проверить библиотеку. <button type="button" onClick={() => void statuses.refetch()}>Повторить</button></p>}
    {library.isError && <p className="error" role="alert">Не удалось обновить библиотеку. Попробуйте ещё раз.</p>}
    {download.isError && <p className="error" role="alert">Не удалось скачать трек. Попробуйте ещё раз.</p>}
  </>;
}
