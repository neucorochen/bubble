import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NotificationDTO,
  Page,
  PostDTO,
  ProfileDTO,
  PublicUser,
  UpdateProfileInput,
  FriendsAccessDTO,
  FriendsVisibility,
  UserSummaryDTO,
} from "@commune/shared";
import { api, withQuery } from "../lib/api";
import { useAuth } from "../store/auth";

export function useProfile(username: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", username.toLowerCase(), user?.id],
    queryFn: () => api<ProfileDTO>(`/users/${encodeURIComponent(username)}`),
  });
}

export function useUserPosts(username: string) {
  return useInfiniteQuery({
    queryKey: ["feed", "user", username.toLowerCase()],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<PostDTO>>(
        withQuery(`/users/${encodeURIComponent(username)}/posts`, { cursor: pageParam }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useToggleFollow(username: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (following: boolean) =>
      api<ProfileDTO>(`/users/${encodeURIComponent(username)}/follow`, {
        method: following ? "PUT" : "DELETE",
      }),
    onSuccess: (profile) => {
      qc.setQueryData(["profile", username.toLowerCase(), user?.id], profile);
      void qc.invalidateQueries({ queryKey: ["profile"] });
      // The "Following" feed changes whenever the follow list changes.
      void qc.invalidateQueries({ queryKey: ["feed", "following"] });
      void qc.invalidateQueries({ queryKey: ["friends-access"] });
      void qc.invalidateQueries({ queryKey: ["friends-list"] });
      void qc.invalidateQueries({ queryKey: ["relationships"] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: ["profile", username.toLowerCase()] });
      void qc.invalidateQueries({ queryKey: ["friends-access"] });
      void qc.invalidateQueries({ queryKey: ["friends-list"] });
      void qc.invalidateQueries({ queryKey: ["feed", "following"] });
      void qc.invalidateQueries({ queryKey: ["relationships"] });
    },
  });
}

export function useFriendsAccess(username: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["friends-access", user?.id, username.toLowerCase()],
    queryFn: () => api<FriendsAccessDTO>(`/users/${encodeURIComponent(username)}/friends/access`),
    enabled: Boolean(user && username),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
}

export function useFriends(username: string, q: string, enabled: boolean, limit = 20) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["friends-list", user?.id, username.toLowerCase(), q, limit],
    enabled: Boolean(user && enabled),
    gcTime: 0,
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<UserSummaryDTO>>(
        withQuery(`/users/${encodeURIComponent(username)}/friends`, {
          q,
          cursor: pageParam,
          limit: String(limit),
        }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  });
}

export function useFriendRequests(type: "incoming" | "outgoing", q: string, enabled: boolean) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ["relationships", user?.id, type, q],
    enabled: Boolean(user && enabled),
    gcTime: 0,
    staleTime: 0,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<UserSummaryDTO>>(
        withQuery("/users/me/relationships", { type, q, cursor: pageParam }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    retry: false,
  });
}

export function useRelationshipCounts(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["relationships", user?.id, "counts"],
    queryFn: () => api<Record<"friends" | "outgoing" | "incoming", number>>("/users/me/relationships/counts"),
    enabled: Boolean(user && enabled), staleTime: 30_000, gcTime: 0, refetchInterval: 30_000, refetchOnWindowFocus: true,
  });
}

export function useFriendsVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendsVisibility: FriendsVisibility) =>
      api<{ friendsVisibility: FriendsVisibility }>("/users/me/friends-visibility", {
        method: "PATCH",
        body: { friendsVisibility },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["friends-access"] });
      void qc.invalidateQueries({ queryKey: ["friends-list"] });
    },
    onError: () => {
      void qc.invalidateQueries({ queryKey: ["friends-access"] });
    },
  });
}

/** Updates the signed-in user's bio and/or avatar. */
export function useUpdateProfile() {
  const qc = useQueryClient();
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      api<PublicUser>("/users/me", { method: "PATCH", body: input }),
    onSuccess: (user) => {
      setUser(user);
      void qc.invalidateQueries({ queryKey: ["profile"] });
      // Avatars appear on posts and comments, so refresh those too.
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["post"] });
      void qc.invalidateQueries({ queryKey: ["comments"] });
    },
  });
}

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationDTO[]>("/notifications"),
    enabled: Boolean(user), refetchInterval: 30_000, refetchOnWindowFocus: true, staleTime: 0,
  });
}

/** Polls every 30 seconds while the tab is open. */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: ["unread-count"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count"),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/notifications/read", { method: "POST" }),
    // Only the badge is refreshed, so the page keeps showing which items were new.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unread-count"] }),
  });
}
