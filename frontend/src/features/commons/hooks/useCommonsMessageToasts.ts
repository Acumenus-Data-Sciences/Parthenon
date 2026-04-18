import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { getEcho } from "@/lib/echo";
import { toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/stores/authStore";
import { useChannels, useDirectMessages } from "../api";
import {
  hasRecentCommonsMessageToast,
  markCommonsMessageToast,
} from "./commonsToastDeduper";

interface BroadcastMessage {
  id: number;
  channel_id: number;
  user: { id: number; name: string };
  body: string;
  parent_id: number | null;
}

export function useCommonsMessageToasts(): void {
  const { t } = useTranslation("commons");
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data: channels = [] } = useChannels();
  const { data: dms = [] } = useDirectMessages();

  useEffect(() => {
    if (!currentUserId) return;

    const echo = getEcho();
    if (!echo) return;

    const channelMap = new Map<number, { slug: string; label: string }>();

    for (const channel of channels) {
      channelMap.set(channel.id, {
        slug: channel.slug,
        label: `#${channel.slug}`,
      });
    }

    for (const dm of dms) {
      channelMap.set(dm.id, {
        slug: dm.slug,
        label: dm.other_user?.name ?? t("chat.toasts.directMessage"),
      });
    }

    const channelIds = [...channelMap.keys()];
    if (channelIds.length === 0) return;

    const activeCommonsSlug = location.pathname.startsWith("/commons/")
      ? location.pathname.replace("/commons/", "")
      : null;

    for (const channelId of channelIds) {
      const meta = channelMap.get(channelId);
      if (!meta) continue;

      echo
        .private(`commons.channel.${channelId}`)
        .listen("MessageSent", (event: { message: BroadcastMessage }) => {
          const { message } = event;
          if (!message || message.user.id === currentUserId) return;

          const outsideCommons = !location.pathname.startsWith("/commons");
          const differentChannel = activeCommonsSlug !== meta.slug;
          if (!outsideCommons || !differentChannel) return;
          if (hasRecentCommonsMessageToast(message.id)) return;

          const preview = message.body.trim() || t("chat.toasts.sentFile");
          markCommonsMessageToast(message.id);
          toast.info(
            t("chat.toasts.newMessage", {
              channel: meta.label,
              user: message.user.name,
              preview: preview.slice(0, 80),
            }),
            {
              label: t("chat.toasts.view"),
              onClick: () =>
                navigate(`/commons/${meta.slug}?highlight=${message.id}`),
            },
          );
        });
    }

    return () => {
      for (const channelId of channelIds) {
        echo.leave(`commons.channel.${channelId}`);
      }
    };
  }, [channels, currentUserId, dms, location.pathname, navigate, t]);
}
