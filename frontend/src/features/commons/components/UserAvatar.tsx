import { useState } from "react";
import { avatarColor } from "../utils/avatarColor";

interface UserAvatarProps {
  user: { id: number; name: string; avatar?: string | null };
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserAvatar({ user, size = "md", className = "" }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = user.avatar && !imgError ? `/storage/${user.avatar}` : null;

  return (
    <div
      className={`${SIZES[size]} shrink-0 rounded-2xl flex items-center justify-center font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] overflow-hidden ${className}`}
      style={avatarUrl ? undefined : { backgroundColor: avatarColor(user.id) }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={user.name}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        getInitials(user.name)
      )}
    </div>
  );
}
