import { useNavigate } from "react-router-dom";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/stores/authStore";
import type { PresenceUser } from "../../types";
import { useCreateDirectMessage } from "../../api";
import { UserAvatar } from "../UserAvatar";

interface OnlineUsersProps {
  users: PresenceUser[];
}

export function OnlineUsers({ users }: OnlineUsersProps) {
  const { t } = useTranslation("commons");
  const navigate = useNavigate();
  const createDm = useCreateDirectMessage();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = useAuthStore((s) => s.user?.id);

  function handleClick(userId: number) {
    if (userId === currentUserId) {
      toast.warning(t("presence.chooseAnotherPerson"));
      return;
    }

    createDm.mutate(userId, {
      onSuccess: (channel) => {
        navigate(`/commons/${channel.slug}`);
      },
      onError: () => {
        toast.error(t("presence.directMessageFailed"));
      },
    });
  }

  const visibleUsers = users.filter((user) => user.id !== currentUserId);
  const currentPresence = users.find((user) => user.id === currentUserId);
  const isCurrentUserOnline = Boolean(currentPresence);

  return (
    <div className="border-t border-white/[0.06] px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("presence.title", { count: visibleUsers.length })}
      </p>

      {currentUser && (
        <div className="mb-3 rounded-xl border border-border-default bg-surface-raised px-3 py-2.5">
          <div className="flex items-center gap-2">
            <UserAvatar user={currentUser} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">{t("presence.you")}</p>
              <p className="text-[11px] text-muted-foreground">
                {!isCurrentUserOnline
                  ? t("presence.presenceUnavailable")
                  : formatPresenceStatus(currentPresence, t)}
              </p>
            </div>
            {isCurrentUserOnline && (
              <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
            )}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            {currentPresence?.sessionCount && currentPresence.sessionCount > 1
              ? t("presence.groupedSessions", { count: currentPresence.sessionCount })
              : t("presence.groupedDevices")}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {visibleUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-default bg-surface-raised px-3 py-3 text-[12px] text-muted-foreground">
            {t("presence.nobodyActive")}
          </div>
        ) : (
          visibleUsers.map((user) => (
            <button
              key={user.id}
              title={t("presence.messageUser", { name: user.name })}
              onClick={() => handleClick(user.id)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-muted/50"
            >
              <div className="relative shrink-0">
                <UserAvatar user={user} size="sm" />
                <span className="absolute -bottom-px -right-px h-[7px] w-[7px] rounded-full bg-green-500 ring-1 ring-card" />
              </div>
              <span className="truncate text-foreground">{user.name}</span>
              <span
                className={`ml-auto shrink-0 text-[11px] ${
                  user.status === "active" ? "text-muted-foreground" : "text-amber-300"
                }`}
              >
                {formatPresenceStatus(user, t)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function formatPresenceStatus(
  user: PresenceUser | undefined,
  t: TFunction<"commons">,
): string {
  if (!user) return t("presence.presenceUnavailable");

  if (user.status === "idle") {
    return user.channelSlug
      ? t("presence.idleInChannel", { channel: user.channelSlug })
      : t("presence.idleInCommons");
  }

  return user.channelSlug
    ? t("presence.viewingChannel", { channel: user.channelSlug })
    : t("presence.onlineInCommons");
}
