import { useInfiniteQuery } from "@tanstack/react-query";
import type { ProfileMusicResponse } from "@commune/shared";
import { Link } from "react-router-dom";
import { api, withQuery } from "../lib/api";
import MusicTrackList from "./MusicTrackList";

export default function ProfileMusic({ username, viewerId, isMe }: { username: string; viewerId: string; isMe: boolean }) {
  const source = `profile:${username.toLowerCase()}`;
  const library = useInfiniteQuery({
    queryKey: ["profile-music", viewerId, username.toLowerCase()],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<ProfileMusicResponse>(withQuery(`/users/${encodeURIComponent(username)}/music`, { cursor: pageParam })),
    getNextPageParam: (last) => last.status === "visible" ? last.nextCursor ?? undefined : undefined,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  if (library.isFetching && !library.isFetchingNextPage) return <section className="card profile-music"><h2>Музыка</h2><p className="muted">Загрузка музыки...</p></section>;
  const pages = library.data?.pages;
  if (pages?.some((page) => page.status === "hidden")) return null;
  const tracks = pages?.flatMap((page) => page.status === "visible" ? page.tracks : []) ?? [];

  return <section className="card profile-music">
    <h2>Музыка</h2>
    {library.isLoading && <p className="muted">Загрузка музыки...</p>}
    {library.isError && <p className="error" role="alert">Не удалось загрузить музыку. <button type="button" className="btn btn-ghost" onClick={() => void library.refetch()}>Повторить</button></p>}
    {!library.isError && pages && tracks.length === 0 && <p className="muted">В библиотеке пока нет музыки. {isMe && <Link to="/music">Добавить музыку</Link>}</p>}
    {!library.isError && <MusicTrackList tracks={tracks} source={source} />}
    {!library.isError && library.hasNextPage && <button type="button" className="btn btn-ghost" disabled={library.isFetchingNextPage} onClick={() => void library.fetchNextPage()}>{library.isFetchingNextPage ? "Загрузка..." : "Показать все"}</button>}
  </section>;
}
