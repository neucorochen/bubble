export const navigationImages: Partial<Record<IconName, string>> = { user: "/icons/navigation/profile.png", home: "/icons/navigation/feed.png", search: "/icons/navigation/search.png", mail: "/icons/navigation/messages.png", users: "/icons/navigation/communities.png", bell: "/icons/navigation/notifications.png", friends: "/icons/navigation/friends.png", settings: "/icons/navigation/settings.png" };
import type { IconName } from "../components/Icon";

export type NavigationItem = { id: string; label: string; guestLabel?: string; to: (username: string) => string; icon: IconName; audience: "member" | "guest"; surfaces: readonly ("desktop" | "drawer" | "bottom" | "header")[]; end?: boolean };
const friends = { id: "friends", label: "Друзья", to: () => "/friends", audience: "member" } as const;
export const navigation: readonly NavigationItem[] = [
  { id: "profile", label: "Профиль", to: (username) => `/u/${username}`, icon: "user", audience: "member", surfaces: ["desktop", "drawer", "bottom"] },
  { ...friends, icon: "users", surfaces: ["drawer"] },
  { id: "feed", label: "Лента", to: () => "/", icon: "home", audience: "member", surfaces: ["desktop", "drawer", "bottom"], end: true },
  { ...friends, icon: "friends", surfaces: ["desktop", "bottom"] },
  { id: "search", label: "Поиск", to: () => "/search", icon: "search", audience: "member", surfaces: ["drawer", "header"] },
  { id: "messages", label: "Сообщения", to: () => "/messages", icon: "mail", audience: "member", surfaces: ["desktop", "drawer", "bottom"] },
  { id: "communities", label: "Группы", to: () => "/communities", icon: "users", audience: "member", surfaces: ["desktop", "drawer", "bottom"] },
  { id: "notifications", label: "События", to: () => "/notifications", icon: "bell", audience: "member", surfaces: ["desktop", "drawer", "bottom"] },
  { id: "settings", label: "Настройки", to: () => "/settings", icon: "settings", audience: "member", surfaces: ["desktop", "drawer", "bottom"] },
  { id: "explore", label: "Обзор", to: () => "/explore", icon: "compass", audience: "guest", surfaces: ["header", "drawer"] },
  { id: "register", label: "Зарегистрироваться", guestLabel: "Создать аккаунт", to: () => "/register", icon: "user", audience: "guest", surfaces: ["header", "drawer"] },
  { id: "login", label: "Войти", to: () => "/login", icon: "user", audience: "guest", surfaces: ["header", "drawer"] },
];
export function navigationFor(audience: NavigationItem["audience"], surface: NavigationItem["surfaces"][number]) {
  return navigation.filter((item) => item.audience === audience && item.surfaces.includes(surface));
}
