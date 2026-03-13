import { Hash, Users } from "lucide-react";
import type { Channel } from "../../types";

interface ChannelHeaderProps {
  channel: Channel;
}

export function ChannelHeader({ channel }: ChannelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <Hash className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">{channel.name}</h2>
        {channel.description && (
          <span className="text-sm text-muted-foreground">{channel.description}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>{channel.members_count}</span>
      </div>
    </div>
  );
}
