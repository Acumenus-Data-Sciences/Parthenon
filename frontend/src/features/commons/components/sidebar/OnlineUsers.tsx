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
      <div className="flex flex-col gap-0.5">
        {users.map((user) => (
          <button
            key={user.id}
            title={`Message ${user.name}`}
            onClick={() => handleClick(user.id)}
            className="flex items-center gap-2 px-1 py-1 text-[13px] rounded hover:bg-muted/50 transition-colors"
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
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                {user.activity}
              </span>
            )}
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
