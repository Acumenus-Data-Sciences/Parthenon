import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getEcho } from "@/lib/echo";
import type { PresenceSession, PresenceUser } from "../types";

const PRESENCE_CHANNEL = "commons.online";
const PRESENCE_SESSION_KEY = "commons-presence-session-id";
const IDLE_TIMEOUT_MS = 90_000;
const ACTIVE_THROTTLE_MS = 15_000;

interface PresenceStatePayload {
  session_id?: string;
  status?: "active" | "idle";
  channel_slug?: string | null;
  last_active_at?: string | null;
}

function getPresenceSessionId(): string {
  const existing = window.sessionStorage.getItem(PRESENCE_SESSION_KEY);
  if (existing) return existing;

  const generated =
    window.crypto?.randomUUID?.() ??
    `presence-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(PRESENCE_SESSION_KEY, generated);
  return generated;
}

function getCommonsSlug(pathname: string): string | null {
  if (!pathname.startsWith("/commons")) return null;
  const [, , slug] = pathname.split("/");
  return slug || "general";
}

function aggregatePresenceSessions(sessions: PresenceSession[]): PresenceUser[] {
  const byUser = new Map<number, PresenceSession[]>();

  for (const session of sessions) {
    const bucket = byUser.get(session.id) ?? [];
    bucket.push(session);
    byUser.set(session.id, bucket);
  }

  return [...byUser.values()]
    .map((userSessions) => {
      const activeSession =
        userSessions.find((session) => session.status !== "idle") ?? userSessions[0];
      const latestActiveAt = userSessions
        .map((session) => session.last_active_at ?? "")
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

      const user: PresenceUser = {
        id: activeSession.id,
        name: activeSession.name,
        status: userSessions.some((session) => session.status !== "idle") ? "active" : "idle",
        sessionCount: userSessions.length,
        channelSlug: activeSession.channel_slug ?? null,
        lastActiveAt: latestActiveAt,
      };

      return user;
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Join the global Commons presence channel and whisper local activity state so
 * other users can see whether this session is active, idle, and which Commons
 * channel it is currently viewing.
 */
export function useGlobalPresence(): void {
  const location = useLocation();
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getEcho>>["join"]> | null>(null);
  const [sessionId] = useState(() =>
    typeof window === "undefined" ? "" : getPresenceSessionId(),
  );
  const lastSentAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<"active" | "idle">("active");
  const channelSlugRef = useRef<string | null>(null);

  const sendPresenceState = useCallback((force = false) => {
    const channel = channelRef.current;
    if (!channel || !sessionId) return;

    const now = Date.now();
    if (!force && statusRef.current === "active" && now - lastSentAtRef.current < ACTIVE_THROTTLE_MS) {
      return;
    }

    lastSentAtRef.current = now;
    channel.whisper("presence-state", {
      session_id: sessionId,
      status: statusRef.current,
      channel_slug: channelSlugRef.current,
      last_active_at: new Date(now).toISOString(),
    });
  }, [sessionId]);

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    channelRef.current = echo.join(PRESENCE_CHANNEL);
    channelSlugRef.current =
      typeof window === "undefined" ? null : getCommonsSlug(window.location.pathname);
    sendPresenceState(true);

    const scheduleIdle = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        statusRef.current = "idle";
        sendPresenceState(true);
      }, IDLE_TIMEOUT_MS);
    };

    const markActive = () => {
      if (document.hidden) return;
      const wasIdle = statusRef.current === "idle";
      statusRef.current = "active";
      sendPresenceState(wasIdle);
      scheduleIdle();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        statusRef.current = "idle";
        sendPresenceState(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        return;
      }

      markActive();
    };

    scheduleIdle();
    window.addEventListener("mousemove", markActive, { passive: true });
    window.addEventListener("keydown", markActive);
    window.addEventListener("focus", markActive);
    window.addEventListener("click", markActive, { passive: true });
    window.addEventListener("scroll", markActive, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("focus", markActive);
      window.removeEventListener("click", markActive);
      window.removeEventListener("scroll", markActive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      channelRef.current = null;
      echo.leave(PRESENCE_CHANNEL);
    };
  }, [sendPresenceState]);

  useEffect(() => {
    channelSlugRef.current = getCommonsSlug(location.pathname);
    statusRef.current = document.hidden ? "idle" : "active";
    sendPresenceState(true);
  }, [location.pathname, sendPresenceState]);
}

/**
 * Subscribe to the global Commons presence channel and aggregate individual
 * browser sessions into user-level presence with session counts and activity.
 */
export function usePresence(): PresenceUser[] {
  const [presenceSessions, setPresenceSessions] = useState<PresenceSession[]>([]);
  const [localSessionId] = useState(() =>
    typeof window === "undefined" ? "" : getPresenceSessionId(),
  );

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    const channel = echo.join(PRESENCE_CHANNEL);

    channel
      .here((users: PresenceSession[]) => {
        setPresenceSessions(
          users.map((user) => ({
            ...user,
            status: user.status ?? "active",
            channel_slug: user.channel_slug ?? null,
            last_active_at: user.last_active_at ?? null,
          })),
        );
      })
      .joining((user: PresenceSession) => {
        setPresenceSessions((prev) =>
          prev.some((existing) => existing.session_id === user.session_id)
            ? prev
            : [
                ...prev,
                {
                  ...user,
                  status: user.status ?? "active",
                  channel_slug: user.channel_slug ?? null,
                  last_active_at: user.last_active_at ?? null,
                },
              ],
        );
      })
      .leaving((user: PresenceSession) => {
        setPresenceSessions((prev) =>
          prev.filter((existing) => existing.session_id !== user.session_id),
        );
      })
      .listenForWhisper("presence-state", (payload: PresenceStatePayload) => {
        if (!payload?.session_id) return;

        setPresenceSessions((prev) =>
          prev.map((session) =>
            session.session_id === payload.session_id
              ? {
                  ...session,
                  status: payload.status ?? session.status ?? "active",
                  channel_slug:
                    payload.channel_slug !== undefined ? payload.channel_slug : session.channel_slug,
                  last_active_at:
                    payload.last_active_at !== undefined
                      ? payload.last_active_at
                      : session.last_active_at,
                }
              : session,
          ),
        );
      });

    return () => {
      channel.stopListeningForWhisper("presence-state");
      echo.leave(PRESENCE_CHANNEL);
    };
  }, []);

  return useMemo(() => {
    const sessions = presenceSessions.map((session) =>
      session.session_id === localSessionId && !session.last_active_at
        ? {
            ...session,
            status: session.status ?? "active",
            last_active_at: new Date().toISOString(),
          }
        : session,
    );

    return aggregatePresenceSessions(sessions);
  }, [localSessionId, presenceSessions]);
}
