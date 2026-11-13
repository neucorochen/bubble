import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WallpaperPage, WallpaperView } from "@commune/shared";
import { api, withQuery } from "../lib/api";

export function useWallpapers(userId: string, view: WallpaperView, q = "") {
  const [position, setPosition] = useState({ view, q, page: 1 });
  const sameFilter = position.view === view && position.q === q;
  const page = sameFilter ? position.page : 1;
  const query = useQuery({
    queryKey: ["wallpapers", userId, view, q, page],
    queryFn: ({ signal }) =>
      api<WallpaperPage>(withQuery("/wallpapers", { view, q, page: String(page) }), { signal }),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === view && previousQuery.queryKey[3] === q ? previous : undefined,
  });
  const totalPages = query.data?.totalPages ?? 0;

  useEffect(() => {
    if (!sameFilter) setPosition({ view, q, page: 1 });
    else if (query.data && !query.isPlaceholderData && page > Math.max(1, totalPages)) {
      setPosition({ view, q, page: Math.max(1, totalPages) });
    }
  }, [sameFilter, view, q, page, totalPages, query.data, query.isPlaceholderData]);

  return {
    ...query,
    items: query.isPlaceholderData ? [] : (query.data?.items ?? []),
    page,
    totalPages,
    goToPage: (next: number) => setPosition({ view, q, page: next }),
  };
}

export function useWallpaperReaction(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      kind,
      enabled,
    }: {
      id: string;
      kind: "like" | "favorite";
      enabled: boolean;
    }) => api<void>(`/wallpapers/${id}/${kind}`, { method: enabled ? "PUT" : "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wallpapers", userId] }),
  });
}
