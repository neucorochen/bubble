import { useQuery } from "@tanstack/react-query";
import type { ProfileMusicResponse } from "@commune/shared";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import MusicTrackList from "./MusicTrackList";

export default function ProfileMusic({ username, viewerId, isMe }: { username: string; viewerId: string; isMe: boolean }) {
  const source = `profile-preview:${username.toLowerCase()}`;
  const library = useQuery({
    queryKey: ["profile-music", viewerId, username.toLowerCase(), "preview"],
    queryFn: () => api<ProfileMusicResponse>(`/users/${encodeURIComponent(username)}/music`),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  if (library.data?.status === "hidden") return null;
  const tracks = library.data?.status === "visible" ? library.data.tracks.slice(0, 3) : [];

  return <section className="card profile-music">
    <div className="profile-music__header"><h2>Музыка</h2>{library.data?.status === "visible" && <Link className="btn" to={isMe ? "/music" : `/u/${encodeURIComponent(username)}/music`}>Открыть</Link>}</div>
    {library.isLoading && <p className="muted">Загрузка музыки...</p>}
    {library.isError && <p className="error" role="alert">Не удалось загрузить музыку. <button type="button" className="btn btn-ghost" onClick={() => void library.refetch()}>Повторить</button></p>}
    {!library.isError && library.data?.status === "visible" && tracks.length === 0 && <p className="muted">В библиотеке пока нет музыки. {isMe && <Link to="/music">Добавить музыку</Link>}</p>}
    {!library.isError && <div className="profile-music__list"><MusicTrackList tracks={tracks} source={source} /></div>}
  </section>;
}
