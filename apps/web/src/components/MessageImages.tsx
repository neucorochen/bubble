import { useQueries } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import ImageGallery from "./ImageGallery";

export default function MessageImages({ ids }: { ids: string[] }) {
  const { user } = useAuth();
  const queries = useQueries({ queries: ids.map((id) => ({
    queryKey: ["message-image", user?.id, id],
    queryFn: () => api<{ url: string }>(`/messages/images/${id}`),
    enabled: Boolean(user), staleTime: 60_000, gcTime: 0,
  })) });
  if (queries.some((query) => query.isLoading)) return <p className="muted small">Загрузка изображений…</p>;
  if (queries.some((query) => query.isError)) return <p className="error small">Не удалось загрузить изображения. <button type="button" onClick={() => queries.forEach((query) => { if (query.isError) void query.refetch(); })}>Повторить</button></p>;
  return <ImageGallery images={queries.flatMap((query) => query.data ? [query.data.url] : [])} alt="Изображение в сообщении" />;
}
