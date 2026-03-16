import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getEcho } from "@/lib/echo";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/components/ui/Toast";
import type { CommonsNotification } from "../types";

const NOTIFICATIONS_KEY = "commons-notifications";

const TYPE_LABEL: Record<string, string> = {
  mention: "mentioned you",
  dm: "sent you a message",
  thread_reply: "replied to your message",
  review_assigned: "requested your review",
  review_resolved: "resolved a review",
};

/**
 * Subscribe to the authenticated user's private notification channel.
 *
 * When a NotificationSent broadcast arrives the hook:
 *   1. Prepends the notification to the TanStack Query cache so the
 *      NotificationBell updates immediately without a round-trip.
 *   2. Increments the unread-count cache entry.
 *   3. Shows a toast with an optional "View" action that navigates to
 *      the relevant channel.
 */
export function useNotificationListener(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;

    const echo = getEcho();
    if (!echo) return;

    const channel = echo.private(`App.Models.User.${userId}`);

    channel.listen(
      ".NotificationSent",
      (event: { notification: CommonsNotification }) => {
        const n = event.notification;

        // 1. Prepend to notification list cache
        qc.setQueryData<CommonsNotification[]>([NOTIFICATIONS_KEY], (old) => {
          if (!old) return [n];
          if (old.some((x) => x.id === n.id)) return old;
          return [n, ...old];
        });

        // 2. Increment unread count
        qc.setQueryData<number>([NOTIFICATIONS_KEY, "unread-count"], (old) =>
          (old ?? 0) + 1,
        );

        // 3. Toast
        const label = TYPE_LABEL[n.type] ?? "notification";
        const message = n.actor
          ? `${n.actor.name} ${label}`
          : n.title;

        const action =
          n.channel?.slug
            ? {
                label: "View",
                onClick: () =>
                  navigate(
                    `/commons/${n.channel!.slug}${n.message_id ? `?highlight=${n.message_id}` : ""}`,
                  ),
              }
            : undefined;

        toast.info(message, action);
      },
    );

    return () => {
      echo.leave(`App.Models.User.${userId}`);
    };
  }, [userId, qc, navigate]);
}
