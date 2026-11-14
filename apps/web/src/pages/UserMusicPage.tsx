import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProfileMusicResponse } from "@commune/shared";
import { Link, Navigate, useParams } from "react-router-dom";
import MusicTrackList from "../components/MusicTrackList";
import { api, withQuery } from "../lib/api";
import { useAuth } from "../store/auth";

export default function UserMusicPage() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const isMe = user?.username.toLowerCase() === username.toLowerCase();
  const library = useInfiniteQuery({
    queryKey: ["profile-music", user?.id, username.toLowerCase(), "full"],
    enabled: Boolean(username && user && !isMe),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<ProfileMusicResponse>(withQuery(`/users/${encodeURIComponent(username)}/music`, { cursor: pageParam })),
    getNextPageParam: (page) => page.status === "visible" ? page.nextCursor ?? undefined : undefined,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const { hasNextPage, isFetching, isError, fetchNextPage } = library;
  useEffect(() => {
    if (hasNextPage && !isFetching && !isError) void fetchNextPage();
  }, [hasNextPage, isFetching, isError, fetchNextPage]);

  if (isMe) return <Navigate to="/music" replace />;
  const hidden = library.data?.pages.some((page) => page.status === "hidden") ?? false;
  const tracks = hidden || library.isError ? [] : library.data?.pages.flatMap((page) => page.status === "visible" ? page.tracks : []) ?? [];
  return <section className="music-page">
    <h1 className="search-title">Музыка @{username}</h1>
    <Link to={`/u/${encodeURIComponent(username)}`}>Вернуться в профиль</Link>
    {hidden ? <p className="muted">Пользователь скрыл свою библиотеку.</p> : <div className="music-page__list">
      {library.isLoading && <p className="muted">Загрузка музыки...</p>}
      {library.isError && <p className="error" role="alert">Не удалось загрузить музыку. <button type="button" className="btn btn-ghost" onClick={() => void library.refetch()}>Повторить</button></p>}
      {!library.isError && library.isSuccess && !tracks.length && <p className="muted">В библиотеке пока нет музыки.</p>}
      <MusicTrackList tracks={tracks} source={`profile-full:${username.toLowerCase()}`} />
      {library.isFetchingNextPage && <p className="muted" role="status">Загрузка остальных треков...</p>}
    </div>}
  </section>;
}
