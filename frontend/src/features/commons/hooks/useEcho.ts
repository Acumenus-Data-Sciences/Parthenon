import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import type { Message } from "../types";

const MESSAGES_KEY = "commons-messages";

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
        if (event.message.parent_id) {
          // Reply: increment reply_count on the parent message
          qc.setQueryData<Message[]>([MESSAGES_KEY, slug], (old) => {
            if (!old) return old;
            return old.map((m) =>
              m.id === event.message.parent_id
                ? {
                    ...m,
                    reply_count: (m.reply_count ?? 0) + 1,
                    latest_reply_at: event.message.created_at,
                  }
                : m,
            );
          });
          // Also append to the thread's reply cache if it exists
          qc.setQueryData<Message[]>(
            [MESSAGES_KEY, slug, "replies", event.message.parent_id],
            (old) => {
              if (!old) return old;
              if (old.some((m) => m.id === event.message.id)) return old;
              return [...old, event.message];
            },
          );
        } else {
          // Top-level message: prepend to main list
          qc.setQueryData<Message[]>([MESSAGES_KEY, slug], (old) => {
            if (!old) return [event.message];
            if (old.some((m) => m.id === event.message.id)) return old;
            return [event.message, ...old];
          });
        }
      })
      .listen(
        "MessageUpdated",
        (event: { message: Partial<Message>; action: string }) => {
          qc.setQueryData<Message[]>([MESSAGES_KEY, slug], (old) => {
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
