import type { ChannelMember } from "../../types";
import { avatarColor } from "../../utils/avatarColor";

interface MemberListProps {
  members: ChannelMember[];
}

export function MemberList({ members }: MemberListProps) {
  if (members.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-[13px] font-medium text-muted-foreground">No members</p>
      </div>
    );
  }

  const sorted = [...members].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    return (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2);
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {members.length} {members.length === 1 ? "member" : "members"}
        </p>
      </div>
      {sorted.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30"
        >
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(member.user_id) }}
          >
            {member.user.name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground">{member.user.name}</span>
          </div>
          {member.role !== "member" && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {member.role}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
