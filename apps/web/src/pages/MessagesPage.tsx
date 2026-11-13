import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RowsSkeleton, ThreadSkeleton } from "../components/Skeleton";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MESSAGE_MAX_LENGTH, type MessageDTO, type MusicTrackDTO } from "@commune/shared";
import Avatar from "../components/Avatar";
import MusicAttachmentPicker from "../components/MusicAttachmentPicker";
import MusicAttachments from "../components/MusicAttachments";
import MessageImages from "../components/MessageImages";
import { LinkedText, LinkPreview, splitLinks } from "../components/LinkContent";
import { useImageDraft } from "../hooks/useImageDraft";
import { useImageDrop } from "../hooks/useImageDrop";
import ImageDropHint from "../components/ImageDropHint";
import Icon from "../components/Icon";
import PlusBadge from "../components/PlusBadge";
import { timeAgo } from "../components/PostCard";
import {
  PENDING_PREFIX,
  loadOlder,
  useConversations,
  useMarkRead,
  useSendMessage,
  useStartChat,
  useThread,
  type MessageDraft,
} from "../hooks/useMessages";
import { joinConversation, noteTyping, stopTyping, useRealtime } from "../lib/realtime";
import { useAuth } from "../store/auth";

/** Text box that sends on Enter (Shift+Enter makes a new line). */
function Composer({
  onSend,
  busy,
  error,
  placeholder,
  onTyping,
  onStopTyping,
}: {
  onSend: (draft: MessageDraft) => Promise<unknown>;
  busy: boolean;
  error?: string | null;
  placeholder: string;
  onTyping?: () => void;
  onStopTyping?: () => void;
}) {
  const [text, setText] = useState("");
  const [tracks, setTracks] = useState<MusicTrackDTO[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const attachmentsRef = useRef<HTMLDivElement>(null);
  const attachmentsButton = useRef<HTMLButtonElement>(null);
  const attachmentsId = useId();
  const images = useImageDraft(true);
  const drop = useImageDrop(images.add, busy);
  const imageInput = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  useEffect(() => {
    if (!attachmentsOpen) return;
    const closeOutside = (event: PointerEvent) => { if (!attachmentsRef.current?.contains(event.target as Node)) setAttachmentsOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [attachmentsOpen]);
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const value = text.trim();
    if ((!value && !tracks.length && !images.images.length) || busy || images.busy || !images.ready || sending.current || pickerOpen) return;
    sending.current = true;
    onStopTyping?.();
    try {
      await onSend({ text: value, tracks, imageIds: images.images.map((image) => image.url!), clientMessageId: crypto.randomUUID() });
      setText("");
      setTracks([]);
      images.clear();
    } catch {
      // Keep the draft available for correction or retry.
    } finally {
      sending.current = false;
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };
  return (
    <>
    <form className="chat-form" onSubmit={(e) => void submit(e)} {...drop.handlers}>
      {error && <p className="error small">{error}</p>}
      <LinkPreview text={text} />
      {images.images.length > 0 && <div className="image-draft">{images.images.map((image) => <div className="image-preview" key={image.id}><img src={image.preview} alt="Предпросмотр вложения" /><button type="button" className="image-remove" disabled={busy} aria-label="Удалить изображение" onClick={() => images.remove(image.id)}>×</button>{image.pending && <span role="status">Загрузка…</span>}{image.error && <p className="error" role="alert">{image.error} <button type="button" onClick={() => images.retry(image)}>Повторить</button></p>}</div>)}</div>}
      {images.error && <p className="error" role="alert">{images.error}</p>}
      {tracks.length > 0 && <div className="chat-draft-tracks" aria-label="Выбранная музыка">
        {tracks.map((track) => <div className="chat-draft-track" key={track.id}>
          <span>{track.title} — {track.artist}</span>
          <button type="button" className="btn btn-ghost" disabled={busy} aria-label={`Убрать ${track.title}`} onClick={() => setTracks((current) => current.filter((item) => item.id !== track.id))}>×</button>
        </div>)}
      </div>}
      <div className="chat-form-row">
        <div className="image-drop-field">
        <textarea
          disabled={busy}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) onTyping?.();
          }}
          onKeyDown={onKey}
          placeholder={placeholder}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          aria-label="Сообщение"
        />
        {drop.dragging && <ImageDropHint />}
        </div>
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) images.add(files); }} />
        <div ref={attachmentsRef} className="chat-attachments" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAttachmentsOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape" && attachmentsOpen) { event.preventDefault(); event.stopPropagation(); setAttachmentsOpen(false); attachmentsButton.current?.focus(); } }}>
          <button ref={attachmentsButton} type="button" className="btn btn-ghost chat-attachments__toggle" disabled={busy} aria-label="Вложения" aria-expanded={attachmentsOpen} aria-controls={attachmentsOpen ? attachmentsId : undefined} title="Вложения" onClick={() => setAttachmentsOpen((open) => !open)}>
            {/* Google Material Icons: attach_file, Apache-2.0. */}
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" /></svg>
          </button>
          {attachmentsOpen && <div id={attachmentsId} className="chat-attachments__menu" role="group" aria-label="Выберите вложение">
            <button type="button" disabled={busy || images.images.length >= 10} onClick={() => { setAttachmentsOpen(false); imageInput.current?.click(); }}><Icon name="image" size={18} /> Фото</button>
            <button type="button" disabled={busy} onClick={() => { setAttachmentsOpen(false); setPickerOpen(true); }}><Icon name="music" size={18} /> Музыка</button>
          </div>}
        </div>
        <button type="submit" className="btn chat-form__send" aria-label="Отправить" title="Отправить" disabled={busy || images.busy || !images.ready || (!text.trim() && !tracks.length && !images.images.length)}>
          {/* Google Material Icons: send, Apache-2.0. */}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" /></svg>
        </button>
      </div>
      {text.length > MESSAGE_MAX_LENGTH - 200 && (
        <span className="muted small">
          {text.length}/{MESSAGE_MAX_LENGTH}
        </span>
      )}
    </form>
    {pickerOpen && <MusicAttachmentPicker selected={tracks} onChange={setTracks} onClose={() => setPickerOpen(false)} />}
    </>
  );
}

function Thread({ id }: { id: string }) {
  const { user } = useAuth();
  const thread = useThread(id);
  const send = useSendMessage(id);
  const markRead = useMarkRead(id);
  const [older, setOlder] = useState<MessageDTO[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | null | undefined>(undefined);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Live: join this conversation's room for typing and online status.
  useEffect(() => joinConversation(id), [id]);
  const otherId = thread.data?.conversation?.other.id;
  const typing = useRealtime((s) => s.typing[id] === true);
  const online = useRealtime((s) => (otherId ? s.presence[otherId] === true : false));

  // A different conversation: forget the older pages of the previous one.
  useEffect(() => {
    setOlder([]);
    setOlderCursor(undefined);
    stick.current = true;
  }, [id]);

  const latest = thread.data?.items;
  const messages = useMemo(() => {
    const seen = new Set<string>();
    return [...older, ...(latest ?? [])].filter((m) => !seen.has(m.id) && seen.add(m.id));
  }, [older, latest]);

  // Stay at the bottom for new messages, unless the person scrolled up to read.
  useLayoutEffect(() => {
    if (stick.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typing]);

  // A message from the other person arrived while this conversation is open and visible: mark
  // it read (the first load is already marked read by the server).
  const lastMessage = messages[messages.length - 1];
  const lastFromOther =
    Boolean(lastMessage) &&
    lastMessage!.senderId !== user?.id &&
    !lastMessage!.id.startsWith(PENDING_PREFIX);
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    if (thread.isSuccess && markedRef.current === null) markedRef.current = lastMessage?.id ?? "";
  }, [thread.isSuccess, lastMessage?.id]);
  useEffect(() => {
    const mark = () => {
      if (!lastFromOther || !lastMessage || markedRef.current === lastMessage.id) return;
      if (document.visibilityState !== "visible") return;
      markedRef.current = lastMessage.id;
      markRead.mutate();
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
    // markRead is stable enough for this purpose; the message id is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage?.id, lastFromOther]);

  const lastMineId = [...messages].reverse().find((m) => m.senderId === user?.id)?.id;

  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const cursor = olderCursor === undefined ? (thread.data?.nextCursor ?? null) : olderCursor;
  const showOlder = async () => {
    if (!cursor) return;
    setLoadingOlder(true);
    stick.current = false;
    try {
      const page = await loadOlder(id, cursor);
      setOlder((o) => [...page.items, ...o]);
      setOlderCursor(page.nextCursor);
    } finally {
      setLoadingOlder(false);
    }
  };

  if (thread.isLoading) return <ThreadSkeleton />;
  if (thread.isError || !thread.data)
    return <p className="error center">Переписка не найдена.</p>;
  const other = thread.data.conversation?.other;

  return (
    <>
      <div className="chat-head">
        <Link to="/messages" className="icon-btn chat-back" aria-label="К списку переписок">
          ←
        </Link>
        {other && (
          <Link to={`/u/${other.username}`} className="person">
            <Avatar username={other.username} url={other.avatarUrl} size={36} />
            <span className="person-text">
              <strong>
                @{other.username} <PlusBadge plus={other.plus} />
              </strong>
              {typing ? (
                <span className="chat-status typing-label">печатает…</span>
              ) : online ? (
                <span className="chat-status">
                  <span className="presence-dot" aria-hidden="true" />  В сети
                </span>
              ) : null}
            </span>
          </Link>
        )}
      </div>

      <div className="chat-messages" ref={listRef} onScroll={onScroll}>
        {cursor && (
          <button
            className="link-btn center"
            onClick={() => void showOlder()}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Загрузка…" : "Загрузить предыдущие сообщения"}
          </button>
        )}
        {messages.length === 0 && <p className="muted center">Сообщений пока нет. Поздоровайтесь!</p>}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          const pending = m.id.startsWith(PENDING_PREFIX);
          return (
            <div
              key={m.id}
              className={`bubble-row${mine ? " mine" : ""}${pending ? " pending" : ""}`}
            >
              <div className={`bubble${m.musicAttachments?.length || m.imageIds?.length || splitLinks(m.text).some((part) => part.href) ? " bubble--music" : ""}`}>
                {m.text && <><span><LinkedText text={m.text} /></span><LinkPreview text={m.text} /></>}
                {(m.imageIds?.length ?? 0) > 0 && <MessageImages ids={m.imageIds!} />}
                {(m.musicAttachments?.length ?? 0) > 0 && <MusicAttachments attachments={m.musicAttachments!} source={`message:${m.senderId}:${m.clientMessageId ?? m.id}`} />}
                <time
                  className="bubble-time"
                  dateTime={m.createdAt}
                  title={new Date(m.createdAt).toLocaleString("ru-RU")}
                >
                  {pending ? "Отправка…" : timeAgo(m.createdAt)}
                </time>
                {mine &&
                  m.id === lastMineId &&
                  !pending &&
                  thread.data?.conversation?.seenByOther && (
                    <span className="bubble-seen">Прочитано</span>
                  )}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="bubble-row" aria-live="polite">
            <div className="bubble typing-bubble" aria-label="Печатает">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        placeholder="Напишите сообщение…"
        busy={send.isPending}
        error={send.isError ? send.error.message : null}
        onTyping={() => noteTyping(id)}
        onStopTyping={() => stopTyping(id)}
        onSend={(text) => {
          stick.current = true;
          return send.mutateAsync(text);
        }}
      />
    </>
  );
}

/** First message to someone you have no conversation with yet (from "Message" on a profile). */
function NewChat({ username }: { username: string }) {
  const navigate = useNavigate();
  const start = useStartChat(username);
  return (
    <>
      <div className="chat-head">
        <Link to="/messages" className="icon-btn chat-back" aria-label="К списку переписок">
          ←
        </Link>
        <strong>Новое сообщение для @{username}</strong>
      </div>
      <div className="chat-messages">
        <p className="muted center">Поздоровайтесь с @{username}. Соблюдайте правила общения: пользователи могут пожаловаться на нарушения.</p>
      </div>
      <Composer
        placeholder={`Сообщение для @${username}…`}
        busy={start.isPending}
        error={start.isError ? start.error.message : null}
        onSend={async (text) => {
          const res = await start.mutateAsync(text);
          navigate(`/messages/${res.conversationId}`, { replace: true });
        }}
      />
    </>
  );
}

export default function MessagesPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const to = params.get("to");
  const { user } = useAuth();
  const navigate = useNavigate();
  const conversations = useConversations();
  const list = conversations.data ?? [];

  // "Message @someone" from a profile: reuse the existing conversation when there is one.
  useEffect(() => {
    if (!to || !conversations.data) return;
    const existing = conversations.data.find(
      (c) => c.other.username.toLowerCase() === to.toLowerCase(),
    );
    if (existing) navigate(`/messages/${existing.id}`, { replace: true });
  }, [to, conversations.data, navigate]);

  const showThread = Boolean(id) || Boolean(to);

  return (
    <div className={`chat${showThread ? " chat-open" : ""}`}>
      <section className="card chat-list" aria-label="Переписки">
        <h1 className="chat-title">Сообщения</h1>
        {conversations.isLoading && <RowsSkeleton count={6} />}
        {conversations.isError && <p className="error center">Не удалось загрузить сообщения.</p>}
        {conversations.data && list.length === 0 && (
          <p className="muted center">

            Переписок пока нет. Откройте профиль пользователя и нажмите <strong>Сообщение</strong>.
          </p>
        )}
        {list.map((c) => (
          <Link
            key={c.id}
            to={`/messages/${c.id}`}
            className={`convo${c.id === id ? " active" : ""}${c.unread > 0 ? " unread" : ""}`}
          >
            <Avatar username={c.other.username} url={c.other.avatarUrl} size={44} />
            <span className="convo-main">
              <span className="convo-top">
                <strong>
                  @{c.other.username} <PlusBadge plus={c.other.plus} />
                </strong>
                <span className="muted small">{timeAgo(c.lastMessageAt)}</span>
              </span>
              <span className="convo-last muted">
                {c.lastMessage
                  ? (c.lastMessage.senderId === user?.id ? "Вы: " : "") + c.lastMessage.text
                  : "Нет сообщений"}
              </span>
            </span>
            {c.unread > 0 && <span className="pill">{c.unread}</span>}
          </Link>
        ))}
      </section>

      <section className="card chat-thread" aria-label="Переписка">
        {id ? (
          <Thread id={id} key={id} />
        ) : to && conversations.data ? (
          <NewChat username={to} />
        ) : (
          <p className="muted center chat-empty">Выберите переписку, чтобы начать общение.</p>
        )}
      </section>
    </div>
  );
}
