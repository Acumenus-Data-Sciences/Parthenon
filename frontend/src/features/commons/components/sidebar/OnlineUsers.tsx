import { useNavigate } from "react-router-dom";
import type { PresenceUser } from "../../types";
import { useCreateDirectMessage } from "../../api";
import { avatarColor } from "../../utils/avatarColor";

interface OnlineUsersProps {
  users: PresenceUser[];
}

export function OnlineUsers({ users }: OnlineUsersProps) {
  const navigate = useNavigate();
  const createDm = useCreateDirectMessage();

  function handleClick(userId: number) {
    createDm.mutate(userId, {
      onSuccess: (channel) => {
        navigate(`/commons/${channel.slug}`);
      },
    });
  }

  return (
    <div className="border-t border-border px-3 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Online — {users.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {users.map((user) => (
          <button
            key={user.id}
            title={`Message ${user.name}`}
            onClick={() => handleClick(user.id)}
            className="relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white hover:ring-2 hover:ring-primary/50 transition-all"
            style={{ backgroundColor: avatarColor(user.id) }}
          >
            {getInitials(user.name)}
            <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border-2 border-card bg-green-500" />
          </button>
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
