
import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useMusicPlayerPosition } from "../hooks/useMusicPlayerPosition";
import { useMusicPlayer } from "../store/music";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function MusicPlayer() {
  const [compact, setCompact] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const libraryBusy = useIsMutating({ mutationKey: ["music-library", user?.id] }) > 0;
  const {
    track,
    nextTrack,
    previousTrack,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    error,
    togglePlayback,
    seek,
    setVolume,
    clear,
    isShuffled,
    repeatMode,
    toggleShuffle,
    cycleRepeatMode,
  } = useMusicPlayer();

  const statusKey = ["music", "membership", user?.id, track?.id];
  const membership = useQuery({
    queryKey: statusKey,
    queryFn: () => api<{ added: boolean }>(`/music/${track!.id}/library`),
    enabled: Boolean(user && track),
  });
  const library = useMutation({
    mutationKey: ["music-library", user?.id],
    mutationFn: ({ id, added }: { id: string; added: boolean }) => api<void>(`/music/${id}/library`, { method: added ? "DELETE" : "POST" }),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(["music", "membership", user?.id, variables.id], { added: !variables.added });
      void queryClient.invalidateQueries({ queryKey: ["music"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-music"] });
      void queryClient.invalidateQueries({ queryKey: ["music-picker"] });
    },
  });
  const download = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/music/${id}/download`),
    onSuccess: ({ url }) => window.location.assign(url),
  });

  const { playerRef, style, handleEvents, prepareModeSwitch } = useMusicPlayerPosition(compact, Boolean(track));

  const previousVolume = useRef(volume > 0 ? volume : 0.5);
  const titleRef = useRef<HTMLDivElement>(null);
  const titleTextRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const container = titleRef.current;
    const text = titleTextRef.current;
    if (!container || !text) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: Animation | undefined;
    const update = () => {
      animation?.cancel();
      const distance = Math.max(0, text.scrollWidth - container.clientWidth);
      if (!distance || motion.matches) return;
      const travel = distance / 30 * 1000;
      const duration = 2000 + travel * 2 + 1500;
      animation = text.animate([
        { transform: "translateX(0)", offset: 0 },
        { transform: "translateX(0)", offset: 2000 / duration },
        { transform: `translateX(-${distance}px)`, offset: (2000 + travel) / duration },
        { transform: `translateX(-${distance}px)`, offset: (3500 + travel) / duration },
        { transform: "translateX(0)", offset: 1 },
      ], { duration, iterations: Infinity, easing: "linear" });
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(text);
    motion.addEventListener("change", update);
    update();
    return () => { observer.disconnect(); motion.removeEventListener("change", update); animation?.cancel(); };
  }, [track?.id, track?.artist, track?.title, compact]);

  if (!track) return null;


  return (
    <section
      ref={playerRef}
      className={`music-player${compact ? " music-player--compact" : ""}`}
      data-positioned={style ? "true" : undefined}
      style={style}
      aria-label="Музыкальный плеер"
    >
      <div className="music-player__controls">
        <button type="button" className="music-player__mode music-player__library" disabled={!membership.data || membership.isFetching || libraryBusy} onClick={() => membership.data && library.mutate({ id: track.id, added: membership.data.added })} aria-label={!membership.data ? "Проверка библиотеки" : membership.data.added ? "Убрать из библиотеки" : "Добавить в библиотеку"} title={membership.isError ? "Не удалось проверить библиотеку" : !membership.data ? "Проверка библиотеки" : membership.data.added ? "Убрать из библиотеки" : "Добавить в библиотеку"}>
          {membership.data && <svg viewBox="0 0 24 24" aria-hidden="true"><path d={membership.data.added ? "M6 6l12 12M18 6 6 18" : "M12 5v14M5 12h14"} /></svg>}
        </button>
        <button
          type="button"
          className={`music-player__mode ${isShuffled ? "is-active" : ""}`}
          onClick={toggleShuffle}
          aria-label="Перемешивание"
          aria-pressed={isShuffled}
          title={isShuffled ? "Выключить перемешивание" : "Включить перемешивание"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3c5 0 6 10 11 10h4m-3-3 3 3-3 3M3 17h3c2 0 3-2 4-4m3-4c1-1 2-2 4-2h4m-3-3 3 3-3 3" /></svg>
        </button>

        <button
          type="button"
          className={`music-player__mode music-player__repeat ${repeatMode !== 0 ? "is-active" : ""}`}
          onClick={cycleRepeatMode}
          aria-label={
            repeatMode === 0
              ? "Повтор выключен"
              : repeatMode === 1
                ? "Повтор всего списка"
                : "Повтор текущего трека"
          }
          aria-pressed={repeatMode !== 0}
          title={
            repeatMode === 0
              ? "Повтор выключен"
              : repeatMode === 1
                ? "Повтор всего списка"
                : "Повтор текущего трека"
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V7a3 3 0 0 1 3-3h10l3 3-3 3M20 15v2a3 3 0 0 1-3 3H7l-3-3 3-3" /></svg>
          {repeatMode === 2 && <span className="music-player__repeat-one" aria-hidden="true">1</span>}
        </button>
        <button
          type="button"
          className="music-player__play"
          onClick={previousTrack}
          aria-label="Предыдущий трек"
          title="Предыдущий трек"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5v14M19 5 7 12l12 7z" /></svg>
        </button>

        <button
          type="button"
          className="music-player__play music-player__play--main"
          onClick={() => void togglePlayback()}
          disabled={isLoading}
          aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
          title={isPlaying ? "Пауза" : "Воспроизвести"}
        >
          {isLoading ? "…" : isPlaying ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14l9-7z" /></svg>}
        </button>

        <button
          type="button"
          className="music-player__play"
          onClick={nextTrack}
          aria-label="Следующий трек"
          title="Следующий трек"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v14M5 5l12 7-12 7z" /></svg>
        </button>

        <div className="music-player__volume">
          <button
            type="button"
            className="music-player__mute"
            aria-label={volume === 0 ? "Включить звук" : "Выключить звук"}
            title={volume === 0 ? "Включить звук" : "Выключить звук"}
            onClick={() => {
              if (volume > 0) {
                previousVolume.current = volume;
                setVolume(0);
              } else {
                setVolume(previousVolume.current);
              }
            }}
          >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={volume === 0 ? "M4 9h4l5-4v14l-5-4H4z M17 9l5 6m0-6-5 6" : "M4 9h4l5-4v14l-5-4H4z M16 9c2 2 2 4 0 6M19 6c4 4 4 8 0 12"} /></svg>
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            style={{ "--range-fill": `${volume * 100}%` } as CSSProperties}
            value={volume}
            onChange={(event) => {
              const nextVolume = Number(event.target.value);
              if (volume > 0) previousVolume.current = volume;
              if (nextVolume > 0) previousVolume.current = nextVolume;
              setVolume(nextVolume);
            }}
            aria-label="Громкость"
          />
        </div>
        {!compact && <button type="button" className="music-player__mode music-player__download" disabled={download.isPending} onClick={() => download.mutate(track.id)} aria-label="Скачать трек" title="Скачать трек"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14" /></svg></button>}
      </div>

      <div className="music-player__extras" {...handleEvents}>
        <div ref={titleRef} className="music-player__title" title={`${track.artist} — ${track.title}`}>
          <span ref={titleTextRef}>{track.artist} — {track.title}</span>
        </div>
        <span className="aero-window-controls music-player__window-controls">
        <span><button type="button" className="music-player__window-button" onClick={() => { prepareModeSwitch(); setCompact(!compact); }} aria-label={compact ? "Развернуть плеер" : "Свернуть плеер"} title={compact ? "Развернуть" : "Свернуть"}><i className={compact ? "aero-control-maximize" : "aero-control-minimize"} aria-hidden="true" /></button></span>
        <span className="aero-window-close">
        <button
          type="button"
          className="music-player__close"
          onClick={clear}
          aria-label="Закрыть плеер"
          title="Закрыть плеер"
        >
          <i className="aero-control-close" aria-hidden="true" />
        </button>
        </span>
        </span>
      </div>

      <div className="music-player__timeline">
        <span>{formatTime(currentTime)}</span>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          style={{ "--range-fill": `${duration ? Math.min(currentTime / duration, 1) * 100 : 0}%` } as CSSProperties}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seek(Number(event.target.value))}
          disabled={!duration}
          aria-label="Позиция воспроизведения"
        />

        <span>{formatTime(duration)}</span>
      </div>

      {error && (
        <div className="music-player__error" role="alert">
          {error}
        </div>
      )}
      {(library.isError || download.isError || membership.isError) && <div className="music-player__error" role="alert">Не удалось выполнить действие. {membership.isError ? <button type="button" onClick={() => void membership.refetch()}>Повторить</button> : "Попробуйте ещё раз."}</div>}
    </section>
  );
}
