import {
  Activity,
  UserPlus,
  Pin,
  ClipboardCheck,
  FileUp,
  Hash,
  Phone,
  Video,
  Zap,
} from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/i18n/format";
import { useActivities } from "../../api";
import type { ActivityItem } from "../../types";
import { UserAvatar } from "../UserAvatar";

interface ActivityFeedProps {
  slug: string;
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  member_joined: UserPlus,
  message_pinned: Pin,
  review_created: ClipboardCheck,
  review_resolved: ClipboardCheck,
  channel_created: Hash,
  file_shared: FileUp,
  call_started: Video,
  call_ended: Phone,
};

const EVENT_COLORS: Record<string, string> = {
  member_joined: "text-green-400 bg-green-400/10",
  message_pinned: "text-amber-400 bg-amber-400/10",
  review_created: "text-blue-400 bg-blue-400/10",
  review_resolved: "text-teal-400 bg-teal-400/10",
  channel_created: "text-purple-400 bg-purple-400/10",
  file_shared: "text-orange-400 bg-orange-400/10",
  call_started: "text-emerald-400 bg-emerald-400/10",
  call_ended: "text-rose-400 bg-rose-400/10",
};

export function ActivityFeed({ slug }: ActivityFeedProps) {
  const { t } = useTranslation("commons");
  const { data: activities = [], isLoading } = useActivities(slug);

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">{t("rightPanel.activity.loading")}</p>;
  }

  if (activities.length === 0) {
    return (
      <div className="m-3 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-default bg-surface-base p-8 text-center">
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <Zap className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <div>
          <p className="text-[13px] text-muted-foreground/70">
            {t("rightPanel.activity.emptyTitle")}
          </p>
          <p className="text-[11px] text-muted-foreground/40 mt-1">
            {t("rightPanel.activity.emptyMessage")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {activities.map((item) => {
        const Icon = EVENT_ICONS[item.event_type] ?? Activity;
        const colorClass = EVENT_COLORS[item.event_type] ?? "text-muted-foreground bg-muted";
        const time = formatDate(item.created_at, {
          hour: "2-digit",
          minute: "2-digit",
        });
        const eventText = getActivityText(item, slug, t);

        return (
          <div
            key={item.id}
            className="flex items-start gap-2.5 rounded-xl border border-border-default bg-surface-base px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          >
            <div className={`mt-0.5 rounded-full p-1.5 ${colorClass}`}>
              <Icon className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {item.user && (
                  <UserAvatar user={item.user} size="sm" />
                )}
                <span className="text-xs text-foreground">{eventText.title}</span>
              </div>
              {eventText.description && (
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                  {eventText.description}
                </p>
              )}
              <span className="text-[10px] text-muted-foreground">{time}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getActivityText(
  item: ActivityItem,
  slug: string,
  t: TFunction<"commons">,
): { title: string; description: string | null } {
  const user = item.user?.name ?? t("rightPanel.activity.fallbackUser");
  const callType = getCallTypeLabel(item, t);

  switch (item.event_type) {
    case "call_started":
      return {
        title: t("rightPanel.activity.events.callStarted.title", { user, callType }),
        description: t("rightPanel.activity.events.callStarted.description", {
          channel: item.channel?.slug ?? slug,
        }),
      };
    case "call_ended":
      return {
        title: t("rightPanel.activity.events.callEnded.title", { user }),
        description: t("rightPanel.activity.events.callEnded.description"),
      };
    case "member_joined":
      return {
        title: t("rightPanel.activity.events.memberJoined.title", { user }),
        description: item.description,
      };
    case "message_pinned":
      return {
        title: t("rightPanel.activity.events.messagePinned.title"),
        description: item.description,
      };
    case "review_created":
      return {
        title: t("rightPanel.activity.events.reviewCreated.title"),
        description: item.description,
      };
    case "review_resolved":
      return {
        title: t("rightPanel.activity.events.reviewResolved.title"),
        description: item.description,
      };
    case "channel_created":
      return {
        title: t("rightPanel.activity.events.channelCreated.title"),
        description: item.description,
      };
    case "file_shared":
      return {
        title: t("rightPanel.activity.events.fileShared.title"),
        description: item.description,
      };
    default:
      return {
        title: item.title,
        description: item.description,
      };
  }
}

function getCallTypeLabel(
  item: ActivityItem,
  t: TFunction<"commons">,
): string {
  const callType = item.metadata?.call_type;
  return callType === "audio"
    ? t("rightPanel.activity.callTypes.audio")
    : t("rightPanel.activity.callTypes.video");
}
