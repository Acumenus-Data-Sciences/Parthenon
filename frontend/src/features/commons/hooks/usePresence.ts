import { useEffect, useState } from "react";
import { getEcho } from "@/lib/echo";
import type { PresenceUser } from "../types";

/**
 * Join the presence channel without tracking state.
 * Mount this in MainLayout so every authenticated user registers as online
 * regardless of which page they are viewing.
 */
export function useGlobalPresence(): void {
  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;
    echo.join("commons.online");
    return () => {
      echo.leave("commons.online");
    };
  }, []);
}

/**
 * Subscribe to the global Commons presence channel.
 * Returns the list of currently online users, updating in real time as
 * users join or leave.
 */
export function usePresence(): PresenceUser[] {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const echo = getEcho();
    if (!echo) return;

    echo
      .join("commons.online")
      .here((users: PresenceUser[]) => {
        setOnlineUsers(users);
      })
      .joining((user: PresenceUser) => {
        setOnlineUsers((prev) =>
          prev.some((u) => u.id === user.id) ? prev : [...prev, user],
        );
      })
      .leaving((user: PresenceUser) => {
        setOnlineUsers((prev) => prev.filter((u) => u.id !== user.id));
      });

    return () => {
      echo.leave("commons.online");
    };
  }, []);

  return onlineUsers;
}
