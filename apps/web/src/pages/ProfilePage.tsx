import { useRef, useState } from "react";
import { ProfileSkeleton } from "../components/Skeleton";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
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
  const profile = useProfile(username);
  const posts = useUserPosts(username);
  const follow = useToggleFollow(username);
  const update = useUpdateProfile();
  const upload = useUploadImage("avatar");
  const ban = useBanUser(username);
  const unban = useUnbanUser(username);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (profile.isLoading) return <ProfileSkeleton />;
  if (profile.isError || !profile.data) return <p className="error center">Пользователь не найден.</p>;

  const p = profile.data;
  const isMe = me?.id === p.id;
  const photoBusy = upload.isPending || update.isPending;
  const isAdmin = me?.role === "admin";

  const suspend = () => {
    if (!window.confirm(`Заблокировать @${p.username}? Пользователь выйдет из аккаунта и не сможет публиковать записи.`))
      return;
    const removePosts = window.confirm("Также удалить все записи пользователя?");
    ban.mutate(removePosts);
  };

  const startEditing = () => {
    setBio(p.bio);
    setEditing(true);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ bio }, { onSuccess: () => setEditing(false) });
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
            <Avatar username={p.username} url={p.avatarUrl} size={72} />
            <div>
              <h1 className="profile-name">
                @{p.username} <PlusBadge plus={p.plus} />
              </h1>
              <p className="muted">Дата регистрации: {new Date(p.createdAt).toLocaleDateString("ru-RU")}</p>
            </div>
          </div>
          {isMe ? (
            !editing && (
              <button className="btn btn-outline" onClick={startEditing}>

                Редактировать профиль
              </button>
            )
          ) : (
            <div className="row">
              <Link
                className="btn btn-outline"
                to={`/messages?to=${encodeURIComponent(p.username)}`}
              >
                <Icon name="mail" size={18} />  Сообщение
              </Link>
              <button
                className={`btn ${p.followedByMe ? "btn-outline" : ""}`}
                title={p.followedByMe && !p.followsMe ? "Отменить исходящую заявку" : undefined}
                onClick={() => {
                  if (p.followedByMe && p.followsMe && !window.confirm("Удалить пользователя из друзей? Вы отпишетесь от него.")) return;
                  follow.mutate(!p.followedByMe);
                }}
                disabled={follow.isPending}
              >
                {p.followedByMe ? (p.followsMe ? "Удалить из друзей" : "Отменить заявку") : (p.followsMe ? "Добавить в ответ" : "Добавить в друзья")}
              </button>
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
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
            >
              {photoBusy
                ? upload.progress
                  ? `Загрузка ${upload.progress}%`
                  : "Сохранение фотографии…"
                : "Изменить фото"}
            </button>
            {p.avatarUrl && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => update.mutate({ avatarUrl: null })}
                disabled={photoBusy}
              >

                Удалить фото
              </button>
            )}
          </div>
        )}
        {photoError && <p className="error">{photoError}</p>}

        {editing ? (
          <form onSubmit={save} className="profile-edit">
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
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>

                  Готово
                </button>
                <button className="btn" disabled={update.isPending}>
                  {update.isPending ? "Сохранение…" : "Сохранить описание"}
                </button>
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
              <button
                className="btn btn-outline"
                onClick={() => unban.mutate()}
                disabled={unban.isPending}
              >

                Разблокировать
              </button>
            ) : (
              <button className="btn btn-danger" onClick={suspend} disabled={ban.isPending}>

                Заблокировать пользователя
              </button>
            )}
          </div>
        )}
        {(ban.isError || unban.isError) && (
          <p className="error">{(ban.error ?? unban.error)?.message}</p>
        )}

        <ProfileFriends key={`${me?.id ?? "guest"}:${username.toLowerCase()}`} username={username} isMe={isMe} />
      </section>

      <PostList query={posts} emptyMessage="Записей пока нет." />
    </>
  );
}
