import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/stores/authStore";
import type { PresenceUser } from "../../types";
import { useCreateDirectMessage } from "../../api";
import { avatarColor } from "../../utils/avatarColor";

interface OnlineUsersProps {
  users: PresenceUser[];
}

export function OnlineUsers({ users }: OnlineUsersProps) {
  const navigate = useNavigate();
  const createDm = useCreateDirectMessage();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = useAuthStore((s) => s.user?.id);

  function handleClick(userId: number) {
    if (userId === currentUserId) {
      toast.warning("Choose another person to start a direct message");
      return;
    }

    createDm.mutate(userId, {
      onSuccess: (channel) => {
        navigate(`/commons/${channel.slug}`);
      },
      onError: () => {
        toast.error("Failed to start direct message");
      },
    });
  }

  const visibleUsers = users.filter((user) => user.id !== currentUserId);
  const currentPresence = users.find((user) => user.id === currentUserId);
  const isCurrentUserOnline = Boolean(currentPresence);

  return (
    <div className="border-t border-white/[0.06] px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Others in Commons — {visibleUsers.length}
      </p>

      {currentUser && (
        <div className="mb-3 rounded-xl border border-[#232328] bg-[#111115] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(currentUser.id) }}
            >
              {getInitials(currentUser.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">You</p>
              <p className="text-[11px] text-muted-foreground">
                {!isCurrentUserOnline
                  ? "Presence unavailable"
                  : currentPresence?.channelSlug
                    ? `${currentPresence.status === "active" ? "Viewing" : "Idle in"} #${currentPresence.channelSlug}`
                    : currentPresence?.status === "active"
                      ? "Online in Commons"
                      : "Idle in Commons"}
              </p>
            </div>
            {isCurrentUserOnline && (
              <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
            )}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            {currentPresence?.sessionCount && currentPresence.sessionCount > 1
              ? `${currentPresence.sessionCount} active sessions on this account are grouped as one person.`
              : "Multiple devices on the same account are grouped as one person for presence."}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {visibleUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#2A2A30] bg-[#111115] px-3 py-3 text-[12px] text-muted-foreground">
            No other users are active in Commons right now.
          </div>
        ) : (
          visibleUsers.map((user) => (
            <button
              key={user.id}
              title={`Message ${user.name}`}
              onClick={() => handleClick(user.id)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-muted/50"
            >
              <div className="relative shrink-0">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                  style={{ backgroundColor: avatarColor(user.id) }}
                >
                  {getInitials(user.name)}
                </div>
                <span className="absolute -bottom-px -right-px h-[7px] w-[7px] rounded-full bg-green-500 ring-1 ring-card" />
              </div>
              <span className="truncate text-foreground">{user.name}</span>
              {user.activity && (
                <span
                  className={`ml-auto shrink-0 text-[11px] ${
                    user.status === "active" ? "text-muted-foreground" : "text-amber-300"
                  }`}
                >
                  {user.activity}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
