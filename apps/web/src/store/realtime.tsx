import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MessageDTO } from "@commune/shared";
import type { ThreadPage } from "../hooks/useMessages";
import { realtimeEnabled, startRealtime, stopRealtime } from "../lib/realtime";
import { isViewingConversation, playSound } from "../lib/sound";
import { useAuth } from "./auth";
import { useUnreadCount } from "../hooks/useSocial";

/** Adds a message to a loaded conversation unless it is already there (own sends arrive twice). */
export function appendUnique(page: ThreadPage, message: MessageDTO): ThreadPage {
  if (page.items.some((m) => m.id === message.id)) return page;
  return { ...page, items: [...page.items, message] };
}

/**
 * Connects the live service while someone is signed in and keeps the data on screen up to date:
 * new messages appear instantly, "seen" ticks over, badges refresh, notifications arrive.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  const unread = useUnreadCount(Boolean(userId));
  const previous = useRef<{ userId: string; count: number } | null>(null);

  useEffect(() => {
    if (!userId || unread.data === undefined) { previous.current = null; return; }
    const count = unread.data.count;
    if (previous.current?.userId === userId && previous.current.count !== count) {
      for (const key of ["relationships", "friends-access", "friends-list", "profile", "notifications"]) void qc.invalidateQueries({ queryKey: [key] });
    }
    previous.current = { userId, count };
  }, [userId, unread.data, qc]);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      for (const key of ["thread", "conversations", "unread-messages", "notifications", "unread-count", "relationships", "friends-access", "friends-list", "profile", "feed"]) void qc.invalidateQueries({ queryKey: [key] });
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("online", refresh); };
  }, [userId, qc]);

  useEffect(() => {
    if (!realtimeEnabled || !userId) return;

    startRealtime({
      onMessage: ({ message }) => {
        const key = ["thread", message.conversationId];
        const fetching = qc.getQueryState(key)?.fetchStatus === "fetching";
        // An older REST snapshot must never overwrite this event. This also covers
        // the first GET, when there is no conversation in the cache to append to yet.
        if (fetching) void qc.cancelQueries({ queryKey: key, exact: true });
        qc.setQueryData<ThreadPage>(key, (old) => {
          if (!old) return old;
          const next = appendUnique(old, message);
          // A new message from me means the other person has not seen it yet.
          if (message.senderId === userId && old.conversation) {
            return { ...next, conversation: { ...old.conversation, seenByOther: false } };
          }
          return next;
        });
        if (fetching) void qc.invalidateQueries({ queryKey: key, exact: true });
        void qc.invalidateQueries({ queryKey: ["conversations"] });
        if (message.senderId !== userId) {
          void qc.invalidateQueries({ queryKey: ["unread-messages"] });
          // A chime for someone else's message, unless you are already reading that conversation.
          if (!isViewingConversation(message.conversationId)) playSound("message");
        }
      },
      onRead: ({ conversationId }) => {
        qc.setQueryData<ThreadPage>(["thread", conversationId], (old) =>
          old?.conversation
            ? { ...old, conversation: { ...old.conversation, seenByOther: true } }
            : old,
        );
        void qc.invalidateQueries({ queryKey: ["conversations"] });
      },
      onNotification: () => {
        if (!(
          document.visibilityState === "visible" && window.location.pathname === "/notifications"
        )) {
          playSound("notification");
        }
        void qc.invalidateQueries({ queryKey: ["notifications"] });
        void qc.invalidateQueries({ queryKey: ["unread-count"] });
        for (const key of ["relationships", "friends-access", "friends-list", "profile"]) void qc.invalidateQueries({ queryKey: [key] });
      },
      onResync: () => {
        // Events sent while the connection was down are gone, so ask the server what changed.
        for (const key of [
          "thread",
          "conversations",
          "unread-messages",
          "notifications",
          "unread-count",
          "relationships", "friends-access", "friends-list", "profile",
        ]) {
          void qc.invalidateQueries({ queryKey: [key] });
        }
      },
    });
    return () => stopRealtime();
  }, [userId, qc]);

  return <>{children}</>;
}
