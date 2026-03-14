import { Pin, Users, Zap } from "lucide-react";
import type { Channel } from "../../types";

interface ChannelHeaderProps {
  channel: Channel;
}

export function ChannelHeader({ channel }: ChannelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-foreground"># {channel.name}</span>
        {channel.description && (
          <span className="text-xs text-muted-foreground ml-1">{channel.description}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <HeaderButton icon={Pin} label="Pins" />
        <HeaderButton icon={Users} label={String(channel.members_count)} />
        <HeaderButton icon={Zap} label="Activity" />
      </div>
    </div>
  );
}

function HeaderButton({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-colors">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
