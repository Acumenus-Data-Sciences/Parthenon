import { Pin, Users, Search, Settings } from "lucide-react";
import type { Channel } from "../../types";

interface ChannelHeaderProps {
  channel: Channel;
  onToggleTab?: (tab: string) => void;
}

export function ChannelHeader({ channel, onToggleTab }: ChannelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 bg-gradient-to-r from-transparent via-white/[0.01] to-transparent">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold text-foreground tracking-tight">
          {channel.type === "dm" ? channel.name.replace(/^DM:\s*/, "") : `# ${channel.name}`}
        </span>
        {channel.description && (
          <span className="text-xs text-muted-foreground ml-2">{channel.description}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <HeaderButton icon={Pin} label="Pins" onClick={() => onToggleTab?.("pinned")} />
        <HeaderButton icon={Search} label="Search" onClick={() => onToggleTab?.("search")} />
        <HeaderButton icon={Users} label={String(channel.members_count)} onClick={() => onToggleTab?.("members")} />
        <HeaderButton icon={Settings} label="" onClick={() => onToggleTab?.("settings")} />
      </div>
    </div>
  );
}

function HeaderButton({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-sm text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-all duration-150"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
