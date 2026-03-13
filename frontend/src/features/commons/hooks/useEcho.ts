import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import type { Message } from "../types";

/**
 * Subscribe to real-time message events for a channel.
 * Appends/updates messages in the TanStack Query cache without requiring a refetch.
 */
export function useChannelSubscription(
  channelId: number | undefined,
  slug: string,
): void {
  const qc = useQueryClient();
  const subscribedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!channelId || subscribedRef.current === channelId) return;

    const echo = getEcho();
    if (!echo) return;

    // Leave the previous channel if we switched
    if (subscribedRef.current !== null) {
      echo.leave(`commons.channel.${subscribedRef.current}`);
    }

    echo
      .private(`commons.channel.${channelId}`)
      .listen("MessageSent", (event: { message: Message }) => {
        qc.setQueryData<Message[]>(["commons-messages", slug], (old) => {
          if (!old) return [event.message];
          // Avoid duplicates (e.g. optimistic + broadcast race)
          if (old.some((m) => m.id === event.message.id)) return old;
          return [event.message, ...old];
        });
      })
      .listen(
        "MessageUpdated",
        (event: { message: Partial<Message>; action: string }) => {
          qc.setQueryData<Message[]>(["commons-messages", slug], (old) => {
            if (!old) return old;
            return old.map((m) =>
              m.id === event.message.id ? { ...m, ...event.message } : m,
            );
          });
        },
      );

    subscribedRef.current = channelId;

    return () => {
      echo.leave(`commons.channel.${channelId}`);
      subscribedRef.current = null;
    };
  }, [channelId, slug, qc]);
}
