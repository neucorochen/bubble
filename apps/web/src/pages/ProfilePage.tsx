import { DISPLAY_NAME_MAX_LENGTH, displayNameOf } from "@commune/shared";
import { useEffect, useRef, useState } from "react";
import { ProfileSkeleton } from "../components/Skeleton";
import type { ChangeEvent, FormEvent } from "react";
import { useParams } from "react-router-dom";
import Composer from "../components/Composer";
import OnlineStatus from "../components/OnlineStatus";
import Avatar from "../components/Avatar";
import ProfileAction from "../components/ProfileAction";
import PlusBadge from "../components/PlusBadge";
import EarningsCard from "../components/EarningsCard";
import PostList from "../components/PostList";
import { useProfile, useToggleFollow, useUpdateProfile, useUserPosts } from "../hooks/useSocial";
import { useBanUser, useUnbanUser } from "../hooks/useModeration";
import { useUploadImage } from "../hooks/useUpload";
import { validateImage } from "../lib/images";
import { useAuth } from "../store/auth";
import ProfileFriends from "../components/ProfileFriends";

export default function ProfilePage() {
  const { username = "" } = useParams();
  const { user: me } = useAuth();
  const profile = useProfile(username, Boolean(username), true);
  const posts = useUserPosts(username);
  const follow = useToggleFollow(username);
  const update = useUpdateProfile();
  const upload = useUploadImage("avatar");
  const ban = useBanUser(username);
  const unban = useUnbanUser(username);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) nameRef.current?.focus(); }, [editing]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setEditing(false), [username]);
  const nickname = profile.data && displayNameOf(profile.data);
  useEffect(() => {
    document.title = `${nickname ?? "Профиль"} · Bubble`;
  }, [nickname, username]);

  if (profile.isLoading) return <ProfileSkeleton />;
  if (profile.isError || !profile.data) return <p className="error center">Пользователь не найден.</p>;

  const p = profile.data;
  const isMe = me?.id === p.id;
  const friendship: { icon: "person_remove" | "close" | "how_to_reg" | "person_add"; label: string } = p.followedByMe
    ? p.followsMe
      ? { icon: "person_remove", label: "Удалить из друзей" }
      : { icon: "close", label: "Отменить исходящую заявку" }
    : p.followsMe
      ? { icon: "how_to_reg", label: "Добавить в ответ" }
      : { icon: "person_add", label: "Добавить в друзья" };
  const photoBusy = upload.isPending || update.isPending;
  const isAdmin = me?.role === "admin";

  const suspend = () => {
    if (!window.confirm(`Заблокировать ${displayNameOf(p)}? Пользователь выйдет из аккаунта и не сможет публиковать записи.`))
      return;
    const removePosts = window.confirm("Также удалить все записи пользователя?");
    ban.mutate(removePosts);
  };

  const startEditing = () => {
    update.reset();
    setDisplayName(displayNameOf(p));
    setBio(p.bio);
    setEditing(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ bio, displayName }, { onSuccess: () => setEditing(false) });
  };

  const pickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setPhotoError(problem);
      return;
    }
    setPhotoError(null);
    upload.mutate(file, {
      onSuccess: ({ url }) =>
        update.mutate({ avatarUrl: url }, { onError: (err) => setPhotoError(err.message) }),
      onError: (err) => setPhotoError(err.message),
    });
  };

  return (
    <>
      <section className="card profile">
        <div className="profile-top">
          <div className="profile-id">
            <Avatar username={p.username} displayName={p.displayName} url={p.avatarUrl} frame={p.avatarFrame} size={72} />
            <div>
              <div className="profile-name-row">
                {isMe && editing ? (
                  <input ref={nameRef} aria-label="Отображаемый ник" form="profile-edit" value={displayName}
                    maxLength={DISPLAY_NAME_MAX_LENGTH} required
                    onChange={(event) => setDisplayName(event.target.value)} />
                ) : <h1 className="profile-name">{displayNameOf(p)}</h1>}
                <OnlineStatus online={isMe || p.online} showText />
                <PlusBadge plus={p.plus} />
              </div>
              <span className="profile-username muted">@{p.username}</span>
              <p className="muted">Дата регистрации: {new Date(p.createdAt).toLocaleDateString("ru-RU")}</p>
            </div>
          </div>
          {isMe ? (
            !editing && (
              <ProfileAction icon="edit" label="Редактировать профиль" onClick={startEditing} />
            )
          ) : (
            <div className="row">
              <ProfileAction icon="mail" label="Сообщение" to={`/messages?to=${encodeURIComponent(p.username)}`} />
              <ProfileAction
                {...friendship}
                className={p.followedByMe ? "btn btn-outline" : "btn"}
                onClick={() => {
                  if (p.followedByMe && p.followsMe && !window.confirm("Удалить пользователя из друзей? Вы отпишетесь от него.")) return;
                  follow.mutate(!p.followedByMe);
                }}
                disabled={follow.isPending}
              />
            </div>
          )}
        </div>

        {isMe && <EarningsCard />}

        {isMe && editing && (
          <div className="row">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={pickPhoto}
            />
            <ProfileAction icon="photo_camera" label="Изменить фото"
              onClick={() => fileRef.current?.click()} disabled={photoBusy} />
            {p.avatarUrl && (
              <ProfileAction icon="delete" label="Удалить фото" className="btn btn-ghost"
                onClick={() => update.mutate({ avatarUrl: null })} disabled={photoBusy} />
            )}
            {photoBusy && <span role="status">{upload.progress !== null
              ? `Загрузка ${upload.progress}%` : "Сохранение…"}</span>}
          </div>
        )}
        {photoError && <p className="error">{photoError}</p>}

        {isMe && editing ? (
          <form id="profile-edit" onSubmit={save} className="profile-edit">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Расскажите сообществу о себе"
            />
            <div className="composer-footer">
              <span className="muted">{bio.length}/160</span>
              <span className="row">
                <ProfileAction icon="close" label="Закрыть редактирование" className="btn btn-ghost"
                  onClick={() => setEditing(false)} />
                <ProfileAction icon="check" label="Сохранить профиль" className="btn" type="submit"
                  disabled={photoBusy || !displayName.trim()} />
              </span>
            </div>
            {update.isError && <p className="error">{update.error.message}</p>}
          </form>
        ) : (
          <p className="profile-bio">
            {p.bio || (isMe ? "Добавьте описание, чтобы другие узнали о вас." : "")}
          </p>
        )}

        {follow.isError && <p className="error">{follow.error.message}</p>}

        {p.banned && <p className="suspended">Этот аккаунт заблокирован.</p>}
        {isAdmin && !isMe && p.role !== "admin" && (
          <div className="row">
            {p.banned ? (
              <ProfileAction icon="lock_open" label="Разблокировать пользователя"
                onClick={() => unban.mutate()} disabled={unban.isPending} />
            ) : (
              <ProfileAction icon="block" label="Заблокировать пользователя" className="btn btn-danger"
                onClick={suspend} disabled={ban.isPending} />
            )}
          </div>
        )}
        {(ban.isError || unban.isError) && (
          <p className="error">{(ban.error ?? unban.error)?.message}</p>
        )}

        <ProfileFriends key={`${me?.id ?? "guest"}:${username.toLowerCase()}`} username={username} isMe={isMe} />
      </section>

      {isMe && !p.banned && <Composer allowPaid={false} />}
      <PostList inlineComments query={posts} emptyMessage="Записей пока нет." />
    </>
  );
}
