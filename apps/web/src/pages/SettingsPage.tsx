import { useCallback, useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useBeforeUnload, useBlocker, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { MAX_FONT_BYTES, type UploadResponse } from "@commune/shared";
import type {
  AvatarFrame,
  AccountUser,
  SiteAppearance,
  SiteFont,
  UpdateAppearanceInput,
  WallpaperDTO,
} from "@commune/shared";
import FriendsPrivacySettings from "../components/FriendsPrivacySettings";
import ProfileAppearancePrivacy from "../components/ProfileAppearancePrivacy";
import UnsavedAppearanceDialog from "../components/UnsavedAppearanceDialog";
import PushSettings from "../components/PushSettings";
import SoundSettings from "../components/SoundSettings";
import Avatar from "../components/Avatar";
import FontSettings from "../components/FontSettings";
import ColorPalette from "../components/ColorPalette";
import WallpaperPagination from "../components/WallpaperPagination";
import WallpaperTile from "../components/WallpaperTile";
import WallpaperWorkshop from "../components/WallpaperWorkshop";
import WallpaperTileActions from "../components/WallpaperTileActions";
import WallpaperReportDialog from "../components/WallpaperReportDialog";
import { useWallpaperReaction, useWallpapers } from "../hooks/useWallpapers";
import { useUploadImage } from "../hooks/useUpload";
import { api, assetUrl } from "../lib/api";
import {
  appearanceStyle,
  DEFAULT_ACCENT,
  DEFAULT_PRIMARY,
  DEFAULT_WALLPAPER,
} from "../lib/appearance";
import { validateImage } from "../lib/images";
import { useAuth } from "../store/auth";
import "../styles/appearance.css";

const DEFAULT_FRAME: AvatarFrame = { effect: "pulse", color: DEFAULT_PRIMARY, intensity: 3 };

type PreviewProps = { onWallpaperPreview?: (path?: string | null) => void };

const SETTINGS_TABS = [
  { id: "appearance", label: "Визуал" },
  { id: "privacy", label: "Приватность" },
  { id: "notifications", label: "Уведомления" },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export default function SettingsPage({ onWallpaperPreview }: PreviewProps) {
  const { user } = useAuth();
  return (
    user && <SettingsSections key={user.id} user={user} onWallpaperPreview={onWallpaperPreview} />
  );
}

function SettingsSections({ user, onWallpaperPreview }: { user: AccountUser } & PreviewProps) {
  const [params, setParams] = useSearchParams();
  const tab = SETTINGS_TABS.find((entry) => entry.id === params.get("tab"))?.id ?? "appearance";
  const [openedAppearance, setOpenedAppearance] = useState(tab === "appearance");

  useEffect(() => {
    if (tab === "appearance") setOpenedAppearance(true);
  }, [tab]);

  function selectTab(next: SettingsTab) {
    setParams(
      (current) => {
        const search = new URLSearchParams(current);
        if (next === "appearance") search.delete("tab");
        else search.set("tab", next);
        return search;
      },
      { preventScrollReset: true },
    );
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = SETTINGS_TABS.length;
    const targets: Record<string, number> = {
      ArrowLeft: (index + count - 1) % count,
      ArrowRight: (index + 1) % count,
      Home: 0,
      End: count - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    const next = SETTINGS_TABS[target];
    if (!next) return;
    event.preventDefault();
    selectTab(next.id);
    document.getElementById(`settings-tab-${next.id}`)?.focus();
  }

  return (
    <>
      <h1 className="page-title">Настройки</h1>
      <div className="tabs feed-tabs settings-tabs" role="tablist" aria-label="Разделы настроек">
        {SETTINGS_TABS.map(({ id, label }, index) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`settings-tab-${id}`}
            aria-controls={`settings-panel-${id}`}
            aria-selected={tab === id}
            className={`tab${tab === id ? " active" : ""}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => selectTab(id)}
            onKeyDown={(event) => navigateTabs(event, index)}
          >
            {label}
          </button>
        ))}
      </div>
      {SETTINGS_TABS.map(({ id }) => (
        <div
          key={id}
          role="tabpanel"
          id={`settings-panel-${id}`}
          aria-labelledby={`settings-tab-${id}`}
          hidden={tab !== id}
          className="settings-panel"
        >
          {id === "appearance" && (tab === id || openedAppearance) && (
            <AppearanceSettings user={user} onWallpaperPreview={onWallpaperPreview} />
          )}
          {id === "privacy" && tab === id && (
            <>
              <ProfileAppearancePrivacy user={user} />
              <FriendsPrivacySettings username={user.username} />
            </>
          )}
          {id === "notifications" && tab === id && (
            <>
              <SoundSettings />
              <PushSettings />
            </>
          )}
        </div>
      ))}
    </>
  );
}

function AppearanceSettings({ user, onWallpaperPreview }: { user: AccountUser } & PreviewProps) {
  const { applyAppearance, isCurrentAccount } = useAuth();
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [report, setReport] = useState<{ item: WallpaperDTO; trigger: HTMLButtonElement }>();
  const reaction = useWallpaperReaction(user.id);
  const favorites = useWallpapers(user.id, "favorites");
  const [changes, setChanges] = useState<Partial<SiteAppearance>>({});
  const [fontFile, setFontFile] = useState<File | null>(null);
  const [fontError, setFontError] = useState<string>();
  const [fontFace, setFontFace] = useState<FontFace>();
  const [uploadedFont, setUploadedFont] = useState<string>();
  const [checkingFont, setCheckingFont] = useState(false);
  const [frameDraft, setFrameDraft] = useState<AvatarFrame | null>();
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string>();
  const [uploaded, setUploaded] = useState<string>();
  const [fileError, setFileError] = useState<string>();
  const upload = useUploadImage("wallpaper");
  const appearance = { ...user.appearance, ...changes };
  const frame = frameDraft === undefined ? (user.avatarFrame ?? null) : frameDraft;
  const dirty = Boolean(
    fontFile || file || frameDraft !== undefined || Object.keys(changes).length,
  );
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || checkingFont) && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state === "blocked" && !dirty && !checkingFont) blocker.proceed();
  }, [blocker, dirty, checkingFont]);
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!dirty && !checkingFont) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [dirty, checkingFont],
    ),
  );
  const save = useMutation({
    mutationFn: async () => {
      if (!isCurrentAccount(user.id)) throw new Error("Сеанс изменился. Откройте настройки снова.");
      const updated = { ...changes };
      if (file) {
        updated.backgroundUrl = uploaded ?? (await upload.mutateAsync(file)).url;
        setUploaded(updated.backgroundUrl);
      }
      if (!isCurrentAccount(user.id)) throw new Error("Сеанс изменился. Откройте настройки снова.");
      if (fontFile) {
        const form = new FormData();
        form.append("file", fontFile);
        updated.font =
          uploadedFont ??
          (await api<UploadResponse>("/uploads/font", { method: "POST", body: form })).url;
        setUploadedFont(updated.font);
      }
      if (!isCurrentAccount(user.id)) throw new Error("Сеанс изменился. Откройте настройки снова.");
      const body: UpdateAppearanceInput = {
        appearance: Object.keys(updated).length ? updated : undefined,
        avatarFrame: frameDraft,
      };
      return api<UpdateAppearanceInput>("/users/me/appearance", { method: "PATCH", body });
    },
    onSuccess: (saved) => {
      applyAppearance(user.id, saved);
      onWallpaperPreview?.();
      setChanges({});
      setFrameDraft(undefined);
      setFile(null);
      setUploaded(undefined);
      setFontFile(null);
      setFontFace(undefined);
      setUploadedFont(undefined);
    },
  });

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    onWallpaperPreview?.(url);
    return () => URL.revokeObjectURL(url);
  }, [file, onWallpaperPreview]);

  useEffect(() => () => onWallpaperPreview?.(), [onWallpaperPreview]);

  const wallpaper =
    (file && localPreview) || assetUrl(appearance.backgroundUrl) || DEFAULT_WALLPAPER;
  const standard = !file && !appearance.backgroundUrl;

  useEffect(() => {
    if (!fontFace) return;
    document.fonts.add(fontFace);
    return () => {
      document.fonts.delete(fontFace);
    };
  }, [fontFace]);

  function selectFont(font: SiteFont | null) {
    setFontFile(null);
    setFontFace(undefined);
    setUploadedFont(undefined);
    setFontError(undefined);
    setChanges((previous) => ({ ...previous, font }));
    save.reset();
  }

  async function chooseFont(next: File) {
    setFontError(undefined);
    save.reset();
    if (next.size > MAX_FONT_BYTES) {
      setFontError("Размер шрифта не должен превышать 2 МБ.");
      return;
    }
    setCheckingFont(true);
    try {
      const face = new FontFace("BubbleFontPreview", await next.arrayBuffer());
      await face.load();
      setFontFile(next);
      setFontFace(face);
      setUploadedFont(undefined);
    } catch {
      setFontError("Не удалось прочитать файл шрифта.");
    } finally {
      setCheckingFont(false);
    }
  }

  function editFrame(next: AvatarFrame | null) {
    setFrameDraft(next);
    save.reset();
  }

  function chooseFile(next?: File) {
    if (!next) return;
    save.reset();
    const problem = validateImage(next);
    setFileError(problem ?? undefined);
    if (problem) return;
    onWallpaperPreview?.();
    setFile(next);
    setUploaded(undefined);
  }

  function selectWallpaper(path: string | null) {
    onWallpaperPreview?.(path);
    setFile(null);
    setUploaded(undefined);
    setFileError(undefined);
    setChanges((previous) => ({ ...previous, backgroundUrl: path }));
    save.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (dirty && !save.isPending && !checkingFont) save.mutate();
  }

  return (
    <>
      <form className="appearance-settings" onSubmit={submit}>
        <fieldset className="appearance-fields" disabled={save.isPending || checkingFont}>
          <section className="card appearance-section" aria-labelledby="wallpaper-title">
            <div className="appearance-section-heading">
              <h2 id="wallpaper-title">Фон сайта</h2>
              <button
                type="button"
                className="btn"
                aria-haspopup="dialog"
                onClick={() => setWorkshopOpen(true)}
              >
                Мастерская фонов
              </button>
            </div>
            <img className="appearance-wallpaper-preview" src={wallpaper} alt="Предпросмотр фона" />
            <div className="appearance-wallpaper-actions">
              <WallpaperTile
                src={DEFAULT_WALLPAPER}
                label="Стандартный"
                selected={standard}
                onSelect={() => selectWallpaper(null)}
              />
              <label className="appearance-file">
                Загрузить картинку
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {fileError && <p role="alert">{fileError}</p>}
            <div className="wallpaper-favorites">
              <h3>Избранное</h3>
              {reaction.error && <p role="alert">{reaction.error.message}</p>}
              {favorites.isPending && <p role="status">Загружаем избранное…</p>}
              {favorites.isError && (
                <button type="button" className="btn" onClick={() => void favorites.refetch()}>
                  Повторить загрузку избранного
                </button>
              )}
              {favorites.isSuccess && !favorites.isPlaceholderData && !favorites.items.length && (
                <p>Пока нет избранных фонов.</p>
              )}
              <div className="wallpaper-grid">
                {favorites.items.map((item) => (
                  <WallpaperTile
                    key={item.id}
                    src={assetUrl(item.imageUrl)}
                    label={item.name}
                    author={item.author}
                    selected={!file && item.imageUrl === appearance.backgroundUrl}
                    onSelect={() => selectWallpaper(item.imageUrl)}
                  >
                    <WallpaperTileActions
                      item={item}
                      reaction={reaction}
                      onReport={(trigger) => setReport({ item, trigger })}
                    />
                  </WallpaperTile>
                ))}
              </div>
              {favorites.totalPages > 1 && (
                <WallpaperPagination query={favorites} label="Страницы избранных фонов" />
              )}
            </div>
          </section>
          <section className="card appearance-section" aria-labelledby="frame-title">
            <h2 id="frame-title">Рамка аватара</h2>
            <div className="appearance-avatar-options">
              <div className="appearance-avatar-preview">
                <Avatar
                  username={user.username}
                  displayName={user.displayName}
                  url={user.avatarUrl}
                  size={68}
                  frame={frame}
                  preview
                />
              </div>
              <div className="appearance-frame-controls">
                <label>
                  Эффект
                  <select
                    value={frame?.effect ?? "none"}
                    onChange={(event) => {
                      const effect = event.target.value;
                      editFrame(
                        effect === "glow" || effect === "pulse"
                          ? { ...(frame ?? DEFAULT_FRAME), effect }
                          : null,
                      );
                    }}
                  >
                    <option value="none">Без рамки</option>
                    <option value="glow">Свечение</option>
                    <option value="pulse">Пульсирующее свечение</option>
                  </select>
                </label>
                {frame && (
                  <label>
                    Сила свечения · {frame.intensity} из 5
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={frame.intensity}
                      onChange={(event) =>
                        editFrame({ ...frame, intensity: event.target.valueAsNumber })
                      }
                    />
                  </label>
                )}
              </div>
            </div>
            {frame && (
              <ColorPalette
                label="Цвет рамки"
                value={frame.color === DEFAULT_FRAME.color ? null : frame.color}
                defaultColor={DEFAULT_FRAME.color}
                onChange={(color) => editFrame({ ...frame, color: color ?? DEFAULT_FRAME.color })}
              />
            )}
          </section>
          <FontSettings
            font={appearance.font}
            file={fontFile}
            error={fontError}
            onChange={selectFont}
            onFile={chooseFont}
          />
          <section className="card appearance-section" aria-labelledby="palette-title">
            <h2 id="palette-title">Цвета сайта</h2>
            <div
              className="appearance-theme-preview"
              data-theme="aero-blue"
              data-custom-primary={Boolean(appearance.primaryColor) || undefined}
              style={appearanceStyle(appearance)}
            >
              <div>Предпросмотр</div>
              <span>Акцент</span>
            </div>
            <ColorPalette
              label="Основной цвет"
              value={appearance.primaryColor ?? null}
              defaultColor={DEFAULT_PRIMARY}
              onChange={(color) => {
                setChanges({ ...changes, primaryColor: color });
                save.reset();
              }}
            />
            <ColorPalette
              label="Акцентный цвет"
              value={appearance.accentColor ?? null}
              defaultColor={DEFAULT_ACCENT}
              onChange={(color) => {
                setChanges({ ...changes, accentColor: color });
                save.reset();
              }}
            />
          </section>
        </fieldset>
        <div className="appearance-save">
          <button className="btn" disabled={!dirty || save.isPending || checkingFont}>
            {upload.isPending
              ? "Загрузка фона…"
              : save.isPending
                ? "Сохранение…"
                : "Сохранить настройки"}
          </button>
          {save.isSuccess && <span role="status">Настройки сохранены</span>}
          {save.error && <span role="alert">{save.error.message}</span>}
        </div>
      </form>
      {blocker.state === "blocked" && (
        <UnsavedAppearanceDialog
          busy={save.isPending}
          canSave={dirty && !checkingFont}
          error={save.error?.message}
          onStay={blocker.reset}
          onDiscard={blocker.proceed}
          onSave={() => save.mutate()}
        />
      )}
      {report && (
        <WallpaperReportDialog
          item={report.item}
          trigger={report.trigger}
          onClose={() => setReport(undefined)}
        />
      )}
      {workshopOpen && (
        <WallpaperWorkshop
          userId={user.id}
          selected={file ? undefined : appearance.backgroundUrl}
          onSelect={selectWallpaper}
          onClose={() => setWorkshopOpen(false)}
        />
      )}
    </>
  );
}
