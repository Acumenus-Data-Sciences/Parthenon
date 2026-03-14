import type { PresenceUser } from "../../types";
import { avatarColor } from "../../utils/avatarColor";

interface OnlineUsersProps {
  users: PresenceUser[];
}

export function OnlineUsers({ users }: OnlineUsersProps) {
  return (
    <div className="border-t border-border px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Online — {users.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {users.map((user) => (
          <div
            key={user.id}
            title={user.name}
            className="relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white"
            style={{ backgroundColor: avatarColor(user.id) }}
          >
            {getInitials(user.name)}
            <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border-2 border-card bg-green-500" />
          </div>
        ))}
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
