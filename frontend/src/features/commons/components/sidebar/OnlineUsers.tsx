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
      <div className="flex flex-col gap-1">
        {users.map((user) => (
          <button
            key={user.id}
            title={`Message ${user.name}`}
            onClick={() => handleClick(user.id)}
            className="flex items-center gap-2 px-1 py-0.5 text-[13px] rounded hover:bg-muted/50 transition-colors"
          >
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-green-500" />
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
