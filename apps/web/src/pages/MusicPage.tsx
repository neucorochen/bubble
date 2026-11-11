import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ALLOWED_MUSIC_TYPES,
  MAX_MUSIC_BYTES,
} from "@commune/shared";
import type {
  MusicTrackDTO,
  MusicUploadTicket,
} from "@commune/shared";
import { api, withQuery } from "../lib/api";
import { useMusicPlayer } from "../store/music";

type MusicScope = "all" | "mine";

const MIME_BY_EXTENSION: Record<string, (typeof ALLOWED_MUSIC_TYPES)[number]> = {
  mp3: "audio/mpeg",
  flac: "audio/flac",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function MusicPage() {
  const queryClient = useQueryClient();
  const { playTrack } = useMusicPlayer();

  const [scope, setScope] = useState<MusicScope>("all");
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tracksQuery = useQuery({
    queryKey: ["music", scope, search],
    queryFn: () =>
      api<MusicTrackDTO[]>(
        withQuery("/music", {
          scope,
          q: search.trim() || undefined,
          limit: "50",
        }),
      ),
  });

  const libraryMutation = useMutation({
    mutationFn: async ({
                         trackId,
                         action,
                       }: {
      trackId: string;
      action: "add" | "remove";
    }) => {
      await api<void>(`/music/${trackId}/library`, {
        method: action === "add" ? "POST" : "DELETE",
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["music"] }),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
                         selectedFile,
                         trackTitle,
                         trackArtist,
                       }: {
      selectedFile: File;
      trackTitle: string;
      trackArtist: string;
    }) => {
      const extension = selectedFile.name.split(".").pop()?.toLowerCase();
      const mimeType = extension ? MIME_BY_EXTENSION[extension] : undefined;

      if (!mimeType || !ALLOWED_MUSIC_TYPES.includes(mimeType)) {
        throw new Error("Поддерживаются MP3, FLAC, WAV, M4A и OGG.");
      }

      if (selectedFile.size > MAX_MUSIC_BYTES) {
        throw new Error("Максимальный размер файла — 100 МБ.");
      }

      const ticket = await api<MusicUploadTicket>("/music/uploads/sign", {
        method: "POST",
        body: {
          title: trackTitle,
          artist: trackArtist,
          mimeType,
          size: selectedFile.size,
        },
      });

      const formData = new FormData();

      for (const [key, value] of Object.entries(ticket.fields)) {
        formData.append(key, value);
      }

      formData.append("file", selectedFile);

      const uploadResponse = await fetch(ticket.url, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Не удалось загрузить файл в хранилище.");
      }

      await api<{ trackId: string }>("/music/uploads/complete", {
        method: "POST",
        body: { uploadId: ticket.uploadId },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["music"] });
      setFile(null);
      setTitle("");
      setArtist("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const tracks = tracksQuery.data ?? [];

  function selectFile(selectedFile: File | undefined) {
    if (!selectedFile) {
      setFile(null);
      return;
    }

    setFile(selectedFile);

    if (!title.trim()) {
      setTitle(selectedFile.name.replace(/\.[^.]+$/, ""));
    }
  }

  function upload() {
    if (!file || !title.trim() || !artist.trim()) return;

    uploadMutation.mutate({
      selectedFile: file,
      trackTitle: title.trim(),
      trackArtist: artist.trim(),
    });
  }

  return (
    <section className="music-page">
    <h1 className="search-title">Музыка</h1>

      <div className="tabs" role="tablist" aria-label="Раздел музыки">
  <button
    type="button"
  role="tab"
  aria-selected={scope === "all"}
  className={`tab ${scope === "all" ? "active" : ""}`}
  onClick={() => setScope("all")}
>
  Вся музыка
  </button>
  <button
  type="button"
  role="tab"
  aria-selected={scope === "mine"}
  className={`tab ${scope === "mine" ? "active" : ""}`}
  onClick={() => setScope("mine")}
>
  Моя библиотека
  </button>
  </div>

  <input
  className="input music-page__search"
  type="search"
  placeholder="Поиск по названию или исполнителю"
  value={search}
  maxLength={100}
  onChange={(event) => setSearch(event.target.value)}
  />

  <section className="card music-page__upload">
    <h2>Загрузить музыку</h2>

  <label className="music-page__field">
    <span>Аудиофайл</span>
    <input
  ref={fileInputRef}
  type="file"
  accept=".mp3,.flac,.wav,.m4a,.ogg,audio/*"
  onChange={(event) => selectFile(event.target.files?.[0])}
  />
  </label>

  {file && (
    <p className="muted">
      {file.name} · {formatSize(file.size)}
    </p>
  )}

  <label className="music-page__field">
    <span>Название</span>
    <input
  className="input"
  value={title}
  maxLength={200}
  onChange={(event) => setTitle(event.target.value)}
  placeholder="Название трека"
    />
    </label>

    <label className="music-page__field">
    <span>Исполнитель</span>
    <input
  className="input"
  value={artist}
  maxLength={200}
  onChange={(event) => setArtist(event.target.value)}
  placeholder="Имя исполнителя"
    />
    </label>

    <button
  type="button"
  className="btn btn-primary"
  onClick={upload}
  disabled={
  !file ||
  !title.trim() ||
  !artist.trim() ||
  uploadMutation.isPending
}
>
  {uploadMutation.isPending ? "Загрузка..." : "Загрузить"}
  </button>

  <p className="muted">
    MP3, FLAC, WAV, M4A, OGG. Максимальный размер — 100 МБ.
  </p>

  {uploadMutation.isError && (
    <p className="error" role="alert">
    {uploadMutation.error.message}
    </p>
  )}
  </section>

  <section className="music-page__list">
  <h2>{scope === "all" ? "Каталог" : "Моя библиотека"}</h2>

  {tracksQuery.isLoading && (
    <p className="muted center">Загрузка музыки...</p>
  )}

  {tracksQuery.isError && (
    <p className="error center" role="alert">
    {tracksQuery.error.message}
    </p>
  )}

  {tracksQuery.isSuccess && tracks.length === 0 && (
    <p className="muted center">
    {scope === "mine"
      ? "В библиотеке пока нет музыки."
      : "Ничего не найдено."}
    </p>
  )}

  {tracks.map((track) => (
    <article className="card music-page__track" key={track.id}>
  <button
    type="button"
    className="music-page__play"
    onClick={() => void playTrack(track, tracks)}
    aria-label={`Воспроизвести ${track.title}`}
    title="Воспроизвести"
      >
              ▶
            </button>

            <div className="music-page__track-info">
  <strong title={track.title}>{track.title}</strong>
    <span className="muted" title={track.artist}>
    {track.artist}
    </span>
    <span className="muted music-page__track-meta">
    {formatSize(track.size)}
    {track.duration != null &&
    ` · ${Math.floor(track.duration / 60)}:${String(
      Math.floor(track.duration % 60),
    ).padStart(2, "0")}`}
    </span>
    </div>

    {track.addedByMe ? (
        <button
          type="button"
      className="btn btn-ghost"
      onClick={() =>
      libraryMutation.mutate({
        trackId: track.id,
        action: "remove",
      })
    }
      disabled={libraryMutation.isPending}
        >
        Убрать
        </button>
    ) : (
      <button
        type="button"
      className="btn btn-ghost"
      onClick={() =>
      libraryMutation.mutate({
        trackId: track.id,
        action: "add",
      })
    }
      disabled={libraryMutation.isPending}
        >
        + В библиотеку
    </button>
    )}
    </article>
  ))}

  {libraryMutation.isError && (
    <p className="error" role="alert">
    {libraryMutation.error.message}
    </p>
  )}
  </section>
  </section>
);
}
