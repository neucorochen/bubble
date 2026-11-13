import { useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, FormEvent } from "react";
import { useCreatePost } from "../hooks/usePosts";
import { useImageDraft } from "../hooks/useImageDraft";
import { useImageDrop } from "../hooks/useImageDrop";
import ImageDropHint from "./ImageDropHint";
import {
  FREE_POST_LENGTH,
  MAX_PREMIUM_LENGTH,
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
  PLUS_POST_LENGTH,
} from "@commune/shared";
import { useAuth } from "../store/auth";
import Avatar from "./Avatar";
import Icon from "./Icon";
import MusicAttachmentPicker from "./MusicAttachmentPicker";
import { LinkPreview } from "./LinkContent";
import type { MusicTrackDTO } from "@commune/shared";

export default function Composer({ communitySlug, allowPaid = true }: { communitySlug?: string; allowPaid?: boolean }) {
  const { user } = useAuth();
  const MAX = user?.plus ? PLUS_POST_LENGTH : FREE_POST_LENGTH;
  const [content, setContent] = useState("");
  const [music, setMusic] = useState<MusicTrackDTO[]>([]);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);
  const imageDraft = useImageDraft();
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState("5");
  const [premium, setPremium] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreatePost();
  const drop = useImageDrop(imageDraft.add, create.isPending);
  const pickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) imageDraft.add(files);
  };
  const imageFiles = (files: FileList | null | undefined) => Array.from(files ?? []).filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.name));
  const onPaste = (e: ClipboardEvent) => { const files = imageFiles(e.clipboardData.files); if (files.length) { e.preventDefault(); imageDraft.add(files); } };

  const priceCents = Math.round(Number(price) * 100);
  const priceOk = priceCents >= MIN_PRICE_CENTS && priceCents <= MAX_PRICE_CENTS;
  const paidOk = !allowPaid || !paid || (priceOk && premium.trim().length > 0);
  const canPost = (content.trim().length > 0 || imageDraft.images.length > 0 || music.length > 0) && !imageDraft.busy && imageDraft.ready && paidOk;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canPost) return;
    create.mutate(
      {
        content,
        imageUrls: imageDraft.images.map((image) => image.url!),
        musicTrackIds: music.map((track) => track.id),
        ...(communitySlug ? { community: communitySlug } : {}),
        ...(allowPaid && paid ? { priceCents, premiumContent: premium } : {}),
      },
      {
        onSuccess: () => {
          setContent("");
          setMusic([]);
          imageDraft.clear();
          setPaid(false);
          setPremium("");
        },
      },
    );
  };

  return (
    <form
      className="card composer"
      onSubmit={submit}
      {...drop.handlers}
    >
      <div className="composer-row">
        {user && <Avatar username={user.username} url={user.avatarUrl} size={42} />}
        <div className="image-drop-field">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            communitySlug ? `Запись в c/${communitySlug}` : "Что нового? Поделитесь со всеми!"
          }
          maxLength={MAX}
          rows={2}
          aria-label="Написать запись"
          onPaste={onPaste}
        />
        {drop.dragging && <ImageDropHint />}
        </div>
      </div>

      {allowPaid && paid && (
        <div className="paid-fields">
          <label>

            Цена (USD, от {MIN_PRICE_CENTS / 100} до {MAX_PRICE_CENTS / 100})
            <input
              type="number"
              min={MIN_PRICE_CENTS / 100}
              max={MAX_PRICE_CENTS / 100}
              step="0.5"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <textarea
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
            placeholder="Платное содержимое. Текст выше останется бесплатным для ознакомления."
            maxLength={MAX_PREMIUM_LENGTH}
            rows={4}
          />
          {!priceOk && <p className="error">Укажите цену в допустимом диапазоне.</p>}
        </div>
      )}

      <LinkPreview text={content} />
      {imageDraft.images.length > 0 && <div className="image-draft">{imageDraft.images.map((image) => <div className="image-preview" key={image.id}><img src={image.preview} alt="Предпросмотр вложения" /><button type="button" className="image-remove" aria-label="Удалить изображение" onClick={() => imageDraft.remove(image.id)}>×</button>{image.pending && <span role="status">Загрузка…</span>}{image.error && <p className="error" role="alert">{image.error} <button type="button" onClick={() => imageDraft.retry(image)}>Повторить</button></p>}</div>)}</div>}
      {imageDraft.error && <p className="error" role="alert">{imageDraft.error}</p>}

      {music.length > 0 && <div className="music-attachments">{music.map((track) => <div className="music-attachments__row" key={track.id}><div className="music-page__track-info"><strong>{track.title}</strong><span>{track.artist}</span></div><button type="button" className="btn btn-ghost" aria-label={`Удалить ${track.title}`} onClick={() => setMusic((tracks) => tracks.filter((item) => item.id !== track.id))}>×</button></div>)}</div>}
      {musicPickerOpen && <MusicAttachmentPicker selected={music} onChange={setMusic} onClose={() => setMusicPickerOpen(false)} />}
      <div className="composer-footer">
        <span className="row">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            hidden
            onChange={pickImage}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileRef.current?.click()}
            disabled={imageDraft.images.length >= 10}
            aria-label="Прикрепить изображение"
          >
            <Icon name="image" size={20} /> Фото
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setMusicPickerOpen(true)}><Icon name="music" size={20} /> Музыка</button>
          {allowPaid && (<>
          <label className="row paid-toggle">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Платная запись
          </label>
          <span className="muted">
            {content.length}/{MAX}
          </span>
          </>)}
        </span>
        <button className="btn" disabled={create.isPending || !canPost}>
          {create.isPending ? "Публикация…" : "Опубликовать"}
        </button>
      </div>
      {create.isError && <p className="error">{create.error.message}</p>}
    </form>
  );
}
