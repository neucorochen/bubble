import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { useMusicPlayer } from "../store/music";
import Icon from "./Icon";

export default function MusicPlayerQueue() {
  const { queue, track, playTrack } = useMusicPlayer();
  const { user } = useAuth();
  const client = useQueryClient();
  const busy = useIsMutating({ mutationKey: ["music-library", user?.id] }) > 0;
  const ids = [...new Set(queue.map((item) => item.id))].sort();
  const statuses = useQuery({
    queryKey: ["music", "statuses", user?.id, ids],
    enabled: Boolean(user && ids.length),
    queryFn: async () => {
      const batches = [];
      for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
      const results = await Promise.all(batches.map((batch) => api<{ ids: string[] }>("/music/library/status", { method: "POST", body: { ids: batch } })));
      return results.flatMap((result) => result.ids);
    },
  });
  const library = useMutation({
    mutationKey: ["music-library", user?.id],
    mutationFn: ({ id, added }: { id: string; added: boolean }) => api<void>(`/music/${id}/library`, { method: added ? "DELETE" : "POST" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["music"] });
      void client.invalidateQueries({ queryKey: ["profile-music"] });
      void client.invalidateQueries({ queryKey: ["music-picker"] });
    },
  });
  const download = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/music/${id}/download`),
    onSuccess: ({ url }) => window.location.assign(url),
  });

  return <div className="music-player__queue music-attachment-picker__scroll" aria-label="Очередь воспроизведения">
    <ol className="music-player__queue-list">
      {queue.map((item, index) => {
        const added = statuses.data?.includes(item.id);
        const time = item.duration == null ? "—" : `${Math.floor(item.duration / 60)}:${String(Math.floor(item.duration % 60)).padStart(2, "0")}`;
        return <li key={`${item.id}-${index}`} className={`music-player__queue-row${item.id === track?.id ? " is-current" : ""}`}>
          <span className="music-player__queue-number">{index + 1}</span>
          <button type="button" className="music-player__queue-title" onClick={() => void playTrack(item)} title={`${item.artist} — ${item.title}`}>{item.artist} — {item.title}</button>
          <span className="music-player__queue-duration" title="Длительность">{time}</span>
          {user && <>
            <button type="button" className="music-player__queue-action" disabled={download.isPending} onClick={() => download.mutate(item.id)} aria-label={`Скачать ${item.title}`} title="Скачать трек"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="none" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" /></svg></button>
            <button type="button" className="music-player__queue-action" disabled={!statuses.data || statuses.isFetching || busy} onClick={() => library.mutate({ id: item.id, added: Boolean(added) })} aria-label={added ? `Убрать ${item.title} из библиотеки` : `Добавить ${item.title} в библиотеку`} title={added ? "Убрать из библиотеки" : "Добавить в библиотеку"}>{statuses.data && <Icon name={added ? "trash" : "plus"} size={added ? 16 : 18} />}</button>
          </>}
        </li>;
      })}
    </ol>
    {(statuses.isError || library.isError || download.isError) && <p role="alert">Не удалось выполнить действие. Попробуйте ещё раз.</p>}
  </div>;
}
