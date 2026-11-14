import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { MusicTrackDTO } from "@commune/shared";
import { api } from "../lib/api";
import { useAuth } from "./auth";

type RepeatMode = 0 | 1 | 2;

interface MusicState {
  track: MusicTrackDTO | null;
  queue: MusicTrackDTO[];
  queueSource: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
  playTrack: (track: MusicTrackDTO, queue?: MusicTrackDTO[], source?: string) => Promise<void>;
  setCurrentQueue: (queue: MusicTrackDTO[], source?: string) => void;
  togglePlayback: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  clear: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
}

const MusicContext = createContext<MusicState | null>(null);

export function MusicPlayerProvider({
                                      children,
                                    }: {
  children: ReactNode;
}) {
  const { user } = useAuth();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef(0);
  const queueRef = useRef<MusicTrackDTO[]>([]);
  const queueIndexRef = useRef(-1);
  const nextTrackRef = useRef<() => void>(() => {});
  const previousTrackRef = useRef<() => void>(() => {});
  const playTrackRef = useRef<(track: MusicTrackDTO) => Promise<void>>(
    async () => {},
  );
  const originalQueueRef = useRef<MusicTrackDTO[]>([]);
  const endedTrackRef = useRef<() => void>(() => {});

  const [track, setTrack] = useState<MusicTrackDTO | null>(null);
  const [queue, setQueue] = useState<MusicTrackDTO[]>([]);
  const [queueSource, setQueueSource] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    const savedVolume = localStorage.getItem("music-volume");

    if (savedVolume === null) return 0.5;

    const parsedVolume = Number(savedVolume);

    if (!Number.isFinite(parsedVolume)) return 0.5;

    return Math.min(1, Math.max(0, parsedVolume));
  });
  const [error, setError] = useState<string | null>(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(0);

  const shuffleTracks = (tracks: MusicTrackDTO[]) => {
    const result = [...tracks];

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      const current = result[i];
      const random = result[j];

      if (!current || !random) continue;

      result[i] = random;
      result[j] = current;
    }

    return result;
  };

  const clear = useCallback(() => {
    requestIdRef.current++;
    queueRef.current = [];
    setQueue([]);
    queueIndexRef.current = -1;
    originalQueueRef.current = [];

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    setTrack(null);
    setQueueSource(null);
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, []);

  // Create one audio element for the lifetime of the provider.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      endedTrackRef.current();
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setError("Не удалось воспроизвести аудиофайл.");
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);

      audioRef.current = null;
    };
    // Audio element is created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the actual audio volume synchronized with React state.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Stop playback when the user logs out.
  useEffect(() => {
    if (!user) {
      clear();
    }
  }, [user, clear]);

  const playTrack = useCallback(
    async (
      nextTrack: MusicTrackDTO,
      nextQueue?: MusicTrackDTO[],
      source?: string,
    ) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (nextQueue) {
        setQueueSource(source ?? null);
        originalQueueRef.current = [...nextQueue];

        queueRef.current = isShuffled
          ? [
            nextTrack,
            ...shuffleTracks(
              nextQueue.filter((item) => item.id !== nextTrack.id),
            ),
          ]
          : [...nextQueue];

      }

      let index = queueRef.current.findIndex(
        (item) => item.id === nextTrack.id,
      );

      if (index === -1) {
        originalQueueRef.current = [nextTrack];
        queueRef.current = [nextTrack];
        index = 0;
      }

      queueIndexRef.current = index;
      setQueue(queueRef.current);

      const requestId = ++requestIdRef.current;

      setTrack(nextTrack);
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setError(null);

      audio.pause();

      try {
        const result = await api<{ url: string }>(
          `/music/${nextTrack.id}/play`,
        );

        // Ignore an outdated request if another track was selected.
        if (requestId !== requestIdRef.current) return;

        audio.src = result.url;
        audio.load();

        await audio.play();
      } catch (err) {
        if (requestId !== requestIdRef.current) return;

        setIsLoading(false);
        setIsPlaying(false);
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось запустить воспроизведение.",
        );
      }
    },
    [isShuffled],
  );

  const nextTrack = useCallback(() => {
    const queue = queueRef.current;
    const nextIndex = queueIndexRef.current + 1;

    if (nextIndex >= queue.length) {
      if (repeatMode === 1 && queue.length > 0) {
        const firstTrack = queue[0];
        if (!firstTrack) return;

        queueIndexRef.current = 0;
        void playTrackRef.current(firstTrack);
      }

      return;
    }

    const next = queue[nextIndex];
    if (!next) return;

    queueIndexRef.current = nextIndex;
    void playTrackRef.current(next);
  }, [repeatMode]);

  const handleTrackEnded = useCallback(() => {
    const audio = audioRef.current;

    // Повтор текущего трека.
    if (repeatMode === 2) {
      if (audio) {
        audio.currentTime = 0;
        void audio.play();
      }
      return;
    }

    const queue = queueRef.current;
    const nextIndex = queueIndexRef.current + 1;

    // Следующий трек.
    if (nextIndex < queue.length) {
      const next = queue[nextIndex];
      if (!next) return;

      queueIndexRef.current = nextIndex;
      void playTrackRef.current(next);
      return;
    }

    // Конец списка — возвращаемся к первому.
    if (repeatMode === 1 && queue.length > 0) {
      const first = queue[0];
      if (!first) return;

      queueIndexRef.current = 0;
      void playTrackRef.current(first);
    }
  }, [repeatMode]);

  const previousTrack = useCallback(() => {
    const audio = audioRef.current;
    const queue = queueRef.current;
    const currentIndex = queueIndexRef.current;

    if (!audio || currentIndex < 0) return;

    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    if (currentIndex > 0) {
      const previousIndex = currentIndex - 1;
      const track = queue[previousIndex];
      if (!track) return;

      queueIndexRef.current = previousIndex;
      void playTrackRef.current(track);
    } else {
      audio.currentTime = 0;
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    const currentTrack = track;

    if (!currentTrack) return;

    const originalQueue = originalQueueRef.current;

    const currentIndex = originalQueue.findIndex(
      (item) => item.id === currentTrack.id,
    );

    if (currentIndex === -1) return;

    const remainingTracks = originalQueue.filter(
      (item) => item.id !== currentTrack.id,
    );

    if (!isShuffled) {
      queueRef.current = [
        currentTrack,
        ...shuffleTracks(remainingTracks),
      ];
    } else {
      queueRef.current = [...originalQueue];
    }

    queueIndexRef.current = queueRef.current.findIndex(
      (item) => item.id === currentTrack.id,
    );
    setQueue(queueRef.current);

    setIsShuffled((previous) => !previous);
  }, [track, isShuffled]);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((previous) => ((previous + 1) % 3) as RepeatMode);
  }, []);

  const setCurrentQueue = useCallback((queue: MusicTrackDTO[], source?: string) => {
    if (!track || !queue.some((item) => item.id === track.id)) return;
    setQueueSource(source ?? null);
    const original = originalQueueRef.current;
    if (original.length === queue.length && original.every((item, index) => item.id === queue[index]?.id)) return;
    originalQueueRef.current = [...queue];
    queueRef.current = isShuffled
      ? [track, ...shuffleTracks(queue.filter((item) => item.id !== track.id))]
      : [...queue];
    queueIndexRef.current = queueRef.current.findIndex((item) => item.id === track.id);
    setQueue(queueRef.current);
  }, [track, isShuffled]);

  useEffect(() => {
    playTrackRef.current = playTrack;
    nextTrackRef.current = nextTrack;
    previousTrackRef.current = previousTrack;
    endedTrackRef.current = handleTrackEnded;
  }, [playTrack, nextTrack, previousTrack, handleTrackEnded]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !track) return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      setError(null);
      await audio.play();
    } catch {
      setIsPlaying(false);
      setError("Не удалось продолжить воспроизведение.");
    }
  }, [track]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;

    audio.currentTime = Math.max(
      0,
      Math.min(time, audio.duration),
    );
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const normalizedVolume = Math.min(1, Math.max(0, nextVolume));

    setVolumeState(normalizedVolume);
    localStorage.setItem("music-volume", String(normalizedVolume));

    if (audioRef.current) {
      audioRef.current.volume = normalizedVolume;
    }
  }, []);

  const value = useMemo(
    () => ({
      track,
      queue,
      queueSource,
      nextTrack,
      previousTrack,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      error,
      playTrack,
      setCurrentQueue,
      togglePlayback,
      pause,
      seek,
      setVolume,
      clear,
      isShuffled,
      repeatMode,
      toggleShuffle,
      cycleRepeatMode,
    }),
    [
      track,
      queue,
      queueSource,
      nextTrack,
      previousTrack,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      error,
      playTrack,
      setCurrentQueue,
      togglePlayback,
      pause,
      seek,
      setVolume,
      clear,
      isShuffled,
      repeatMode,
      toggleShuffle,
      cycleRepeatMode,
    ],
  );

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicContext);

  if (!context) {
    throw new Error(
      "useMusicPlayer must be used inside MusicPlayerProvider",
    );
  }

  return context;
}
