import { MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/stores/authStore";
import { useCreateDirectMessage } from "../../api";
import type { ChannelMember, PresenceUser } from "../../types";
import { UserAvatar } from "../UserAvatar";

interface MemberListProps {
  members: ChannelMember[];
  presenceUsers?: PresenceUser[];
}

export function MemberList({ members, presenceUsers = [] }: MemberListProps) {
  const navigate = useNavigate();
  const createDm = useCreateDirectMessage();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const presenceByUserId = new Map(presenceUsers.map((user) => [user.id, user]));

  if (members.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <div className="w-full rounded-2xl border border-dashed border-[#2b2b32] bg-[#111115] px-4 py-6">
          <p className="text-[13px] font-medium text-muted-foreground">No members</p>
        </div>
      </div>
    );
  }

  const sorted = [...members].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    const presenceA = presenceByUserId.get(a.user_id);
    const presenceB = presenceByUserId.get(b.user_id);
    const onlineDelta = Number(Boolean(presenceB)) - Number(Boolean(presenceA));
    if (onlineDelta !== 0) return onlineDelta;
    if ((presenceA?.status ?? "idle") !== (presenceB?.status ?? "idle")) {
      return (presenceB?.status ?? "idle") === "active" ? 1 : -1;
    }
    return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"}
        </p>
      </div>
      {sorted.map((member) => {
        const presence = presenceByUserId.get(member.user_id);
        const isOnline = Boolean(presence);
        const isActive = presence?.status === "active";
        const statusLabel = !presence
          ? "Away"
          : presence.channelSlug
            ? `${isActive ? "Viewing" : "Idle in"} #${presence.channelSlug}`
            : isActive
              ? "In Commons now"
              : "Idle";

        return (
          <div
            key={member.id}
            className="mx-3 mb-2 flex items-center gap-2.5 rounded-xl border border-[#25252b] bg-[#111115] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-[#31313a] hover:bg-[#15151a]"
          >
          <div className="relative shrink-0">
            <UserAvatar user={{ id: member.user_id, name: member.user.name }} size="sm" />
            {isOnline && (
              <span
                className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-surface-raised ${
                  isActive ? "bg-green-500" : "bg-amber-400"
                }`}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground">{member.user.name}</span>
            <p className="text-[11px] text-muted-foreground">{statusLabel}</p>
          </div>
          {member.user_id !== currentUserId && (
            <button
              type="button"
              title={`Message ${member.user.name}`}
              onClick={() => {
                createDm.mutate(member.user_id, {
                  onSuccess: (channel) => {
                    navigate(`/commons/${channel.slug}`);
                  },
                  onError: () => {
                    toast.error("Failed to start direct message");
                  },
                });
              }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          )}
          {member.role !== "member" && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {member.role}
            </span>
          )}
          </div>
        );
      })}
    </div>
  );
}
