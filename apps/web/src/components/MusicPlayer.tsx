
import { useMusicPlayer } from "../store/music";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function MusicPlayer() {
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

  if (!track) return null;


  return (
    <section className="music-player" aria-label="Музыкальный плеер">
      <div className="music-player__info">
        <div className="music-player__cover" aria-hidden="true">
          ♫
        </div>

        <div className="music-player__track">
          <div className="music-player__title" title={track.title}>
            {track.title}
          </div>
          <div className="music-player__artist" title={track.artist}>
            {track.artist}
          </div>
        </div>
      </div>

      <div className="music-player__controls">
        <button
          type="button"
          className={`music-player__mode ${isShuffled ? "is-active" : ""}`}
          onClick={toggleShuffle}
          aria-label="Перемешивание"
          aria-pressed={isShuffled}
          title={isShuffled ? "Выключить перемешивание" : "Включить перемешивание"}
        >
          🔀
        </button>

        <button
          type="button"
          className="music-player__play"
          onClick={previousTrack}
          aria-label="Предыдущий трек"
          title="Предыдущий трек"
        >
          ⏮
        </button>

        <button
          type="button"
          className="music-player__play music-player__play--main"
          onClick={() => void togglePlayback()}
          disabled={isLoading}
          aria-label={isPlaying ? "Пауза" : "Воспроизвести"}
          title={isPlaying ? "Пауза" : "Воспроизвести"}
        >
          {isLoading ? "…" : isPlaying ? "⏸" : "▶"}
        </button>

        <button
          type="button"
          className="music-player__play"
          onClick={nextTrack}
          aria-label="Следующий трек"
          title="Следующий трек"
        >
          ⏭
        </button>

        <button
          type="button"
          className={`music-player__mode ${repeatMode !== 0 ? "is-active" : ""}`}
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
          {repeatMode === 2 ? "🔂" : "🔁"}
        </button>
      </div>

      <div className="music-player__extras">
        <label className="music-player__volume">
          <span aria-hidden="true">♫</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Громкость"
          />
        </label>

        <button
          type="button"
          className="music-player__close"
          onClick={clear}
          aria-label="Закрыть плеер"
          title="Закрыть плеер"
        >
          ×
        </button>
      </div>

      <div className="music-player__timeline">
        <span>{formatTime(currentTime)}</span>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
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
    </section>
  );
}
