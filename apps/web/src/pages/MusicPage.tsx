import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ALLOWED_MUSIC_TYPES, MAX_MUSIC_BYTES } from "@commune/shared";
import type { MusicTrackDTO, MusicUploadTicket } from "@commune/shared";
import { api, withQuery } from "../lib/api";
import MusicTrackList from "../components/MusicTrackList";
import { useAuth } from "../store/auth";
import type { MusicSettings } from "@commune/shared";

type MusicScope = "all" | "mine" | "settings";

const MUSIC_TABS = [
  { scope: "mine", label: "Моя библиотека" },
  { scope: "all", label: "Вся музыка" },
  { scope: "settings", label: "Настройки музыкальной библиотеки" },
] as const;

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

function readAudioDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => finish(), 10000);
    function finish(duration?: number) {
      window.clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
      resolve(duration);
    }
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const value = audio.duration;
      finish(Number.isFinite(value) && value > 0 && value <= 604800 ? value : undefined);
    };
    audio.onerror = () => finish();
    audio.src = url;
  });
}

export default function MusicPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [scope, setScope] = useState<MusicScope>("mine");
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [readingMetadata, setReadingMetadata] = useState(false);
  const fileSelection = useRef(0);
  const editedFields = useRef({ title: false, artist: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<Partial<Record<MusicScope, HTMLButtonElement>>>({});

  const tracksQuery = useQuery({
    queryKey: ["music", scope, search, user?.id],
    queryFn: () =>
      api<MusicTrackDTO[]>(
        withQuery("/music", {
          scope,
          q: search.trim() || undefined,
          limit: "50",
        }),
      ),
    enabled: scope !== "settings",
  });

  const settingsQuery = useQuery({
    queryKey: ["music-settings", user?.id],
    queryFn: () => api<MusicSettings>("/users/me/music-settings"),
    enabled: scope === "settings" && !!user,
  });
  const settingsMutation = useMutation({
    mutationFn: (visibility: MusicSettings["visibility"]) => api<MusicSettings>("/users/me/music-settings", { method: "PATCH", body: { visibility } }),
    onSuccess: (data) => {
      queryClient.setQueryData(["music-settings", user?.id], data);
      void queryClient.invalidateQueries({ queryKey: ["profile-music"] });
    },
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

      const durationPromise = readAudioDuration(selectedFile);
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
        body: { uploadId: ticket.uploadId, duration: await durationPromise },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["music"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-music"] });
      void queryClient.invalidateQueries({ queryKey: ["music-picker"] });
      dialogRef.current?.close();
      resetUploadForm();
    },
  });

  const tracks = tracksQuery.data ?? [];

  function selectFile(selectedFile: File | undefined) {
    const selection = ++fileSelection.current;
    if (!selectedFile) {
      setFile(null);
      setReadingMetadata(false);
      return;
    }

    setFile(selectedFile);

    const name = selectedFile.name.replace(/\.[^.]+$/, "");
    const separator = name.indexOf("-");

    if (!editedFields.current.title) {
      setTitle((separator < 0 ? name : name.slice(separator + 1)).trim());
    }
    if (!editedFields.current.artist) {
      setArtist(separator < 0 ? "" : name.slice(0, separator).trim());
    }

    setReadingMetadata(true);
    void import("music-metadata")
      .then(({ parseBlob }) => parseBlob(selectedFile, { skipCovers: true }))
      .then(({ common }) => {
        if (fileSelection.current !== selection) return;
        if (!editedFields.current.title && common.title?.trim()) setTitle(common.title.trim());
        if (!editedFields.current.artist && common.artist?.trim()) setArtist(common.artist.trim());
      })
      .catch(() => {
        // Missing or unreadable tags leave the filename-based values in place.
      })
      .finally(() => {
        if (fileSelection.current === selection) setReadingMetadata(false);
      });
  }

  function resetUploadForm() {
    fileSelection.current++;
    setReadingMetadata(false);
    setFile(null);
    setTitle("");
    setArtist("");
    editedFields.current = { title: false, artist: false };
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeUploadDialog() {
    if (uploadMutation.isPending) return;
    dialogRef.current?.close();
    resetUploadForm();
    uploadMutation.reset();
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !title.trim() || !artist.trim() || readingMetadata || uploadMutation.isPending) return;

    uploadMutation.mutate({
      selectedFile: file,
      trackTitle: title.trim(),
      trackArtist: artist.trim(),
    });
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, currentScope: MusicScope) {
    let nextScope: MusicScope;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
        { const index = MUSIC_TABS.findIndex((tab) => tab.scope === currentScope);
          nextScope = MUSIC_TABS[(index + (event.key === "ArrowRight" ? 1 : MUSIC_TABS.length - 1)) % MUSIC_TABS.length]!.scope; }
        break;
      case "Home":
        nextScope = "mine";
        break;
      case "End":
        nextScope = "settings";
        break;
      default:
        return;
    }

    event.preventDefault();
    setScope(nextScope);
    tabRefs.current[nextScope]?.focus();
  }

  return (
    <section className="music-page">
      <h1 className="search-title">Музыка</h1>

      <div className="music-page__toolbar">
        <input
          className="input music-page__search"
          type="search"
          aria-label="Поиск по названию или исполнителю"
          placeholder="Поиск по названию или исполнителю"
          value={search}
          maxLength={100}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          className="aero-button"
          aria-haspopup="dialog"
          onClick={() => {
            uploadMutation.reset();
            dialogRef.current?.showModal();
            fileInputRef.current?.focus();
          }}
        >
          Загрузить музыку
        </button>
      </div>

      <div className="tabs feed-tabs music-page__tabs" role="tablist" aria-label="Раздел музыки">
        {MUSIC_TABS.map(({ scope: tabScope, label }) => (
          <button
            key={tabScope}
            ref={(button) => {
              tabRefs.current[tabScope] = button ?? undefined;
            }}
            id={`music-tab-${tabScope}`}
            type="button"
            role="tab"
            aria-selected={scope === tabScope}
            aria-controls={`music-panel-${tabScope}`}
            tabIndex={scope === tabScope ? 0 : -1}
            className={scope === tabScope ? "tab active" : "tab"}
            aria-label={label}
            title={tabScope === "settings" ? label : undefined}
            onClick={() => setScope(tabScope)}
            onKeyDown={(event) => handleTabKey(event, tabScope)}
          >
            {tabScope === "settings" ? <span aria-hidden="true">⚙</span> : label}
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="music-page__upload-dialog"
        aria-labelledby="music-upload-title"
        onCancel={(event) => {
          event.preventDefault();
          closeUploadDialog();
        }}
      >
        <header className="music-attachment-picker__header">
          <h2 id="music-upload-title">Загрузить музыку</h2>
          <span className="aero-window-controls music-player__window-controls">
            <span className="aero-window-close">
              <button type="button" className="music-player__close" onClick={closeUploadDialog} disabled={uploadMutation.isPending} aria-label="Закрыть окно загрузки" title="Закрыть">
                <i className="aero-control-close" aria-hidden="true" />
              </button>
            </span>
          </span>
        </header>

        <form className="music-page__upload-form" onSubmit={upload}>
          <fieldset disabled={uploadMutation.isPending}>
            <label className="music-page__field">
              <span>Аудиофайл</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.flac,.wav,.m4a,.ogg,audio/*"
                aria-describedby="music-upload-limits"
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
                className="aero-input"
                value={title}
                maxLength={200}
                onChange={(event) => {
                  editedFields.current.title = true;
                  setTitle(event.target.value);
                }}
              />
            </label>

            <label className="music-page__field">
              <span>Исполнитель</span>
              <input
                className="aero-input"
                value={artist}
                maxLength={200}
                onChange={(event) => {
                  editedFields.current.artist = true;
                  setArtist(event.target.value);
                }}
              />
            </label>
          </fieldset>

          <p className="muted" id="music-upload-limits">
            MP3, FLAC, WAV, M4A, OGG. Максимальный размер — 100 МБ.
          </p>

          {uploadMutation.isError && (
            <p className="aero-error" role="alert">
              {uploadMutation.error.message}
            </p>
          )}

          <div className="music-page__upload-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!file || !title.trim() || !artist.trim() || readingMetadata || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Загрузка..." : "Загрузить"}
            </button>
            <button
              type="button"
              className="aero-button"
              onClick={closeUploadDialog}
              disabled={uploadMutation.isPending}
            >
              Отмена
            </button>
          </div>
          <span className="music-page__upload-status" role="status">
            {uploadMutation.isPending ? "Загрузка музыки..." : readingMetadata ? "Чтение данных трека..." : ""}
          </span>
        </form>
      </dialog>

      {MUSIC_TABS.map(({ scope: tabScope }) => (
        <div
          key={tabScope}
          id={`music-panel-${tabScope}`}
          role="tabpanel"
          aria-labelledby={`music-tab-${tabScope}`}
          hidden={scope !== tabScope}
          tabIndex={0}
        >
          {scope === tabScope && tabScope === "settings" && (
            <section className="aero-panel music-settings">
              <h2>Кто может видеть музыку в моём профиле?</h2>
              <p>Настройка влияет на отображение библиотеки в профиле, но не скрывает треки из общего каталога.</p>
              {settingsQuery.isLoading && <p>Загрузка настроек...</p>}
              {settingsQuery.isError && <p className="error" role="alert">Не удалось загрузить настройки. <button type="button" className="btn btn-ghost" onClick={() => void settingsQuery.refetch()}>Повторить</button></p>}
              {settingsQuery.data && <fieldset disabled={settingsMutation.isPending}>
                <label><input type="radio" name="music-visibility" checked={settingsQuery.data.visibility === "everyone"} onChange={() => settingsMutation.mutate("everyone")} /> Все пользователи</label>
                <label><input type="radio" name="music-visibility" checked={settingsQuery.data.visibility === "private"} onChange={() => settingsMutation.mutate("private")} /> Только я</label>
              </fieldset>}
              {settingsMutation.isPending && <p role="status">Сохранение...</p>}
              {settingsMutation.isError && <p className="error" role="alert">Не удалось сохранить настройку. Попробуйте ещё раз.</p>}
            </section>
          )}
          {scope === tabScope && tabScope !== "settings" && (
            <section className="music-page__list">
              <h2>{scope === "all" ? "Каталог" : "Моя библиотека"}</h2>

              {tracksQuery.isLoading && <p className="muted center">Загрузка музыки...</p>}

              {tracksQuery.isError && (
                <p className="error center" role="alert">
                  {tracksQuery.error.message}
                </p>
              )}

              {tracksQuery.isSuccess && tracks.length === 0 && (
                <p className="muted center">
                  {scope === "mine" ? "В библиотеке пока нет музыки." : "Ничего не найдено."}
                </p>
              )}

              <MusicTrackList tracks={tracks} source={`music:${user?.id}:${scope}`} />
            </section>
          )}
        </div>
      ))}
    </section>
  );
}
