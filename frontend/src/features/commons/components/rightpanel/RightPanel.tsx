import { Pin, FileText, Search, Users, Settings } from "lucide-react";
import type { Channel, ChannelMember } from "../../types";
import { PinnedList } from "./PinnedList";
import { SearchPanel } from "./SearchPanel";
import { MemberList } from "./MemberList";
import { ChannelSettings } from "./ChannelSettings";

const TABS = [
  { key: "pinned", label: "Pinned", icon: Pin },
  { key: "search", label: "Search", icon: Search },
  { key: "members", label: "Members", icon: Users },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

interface RightPanelProps {
  slug: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  members: ChannelMember[];
  channel?: Channel;
  currentMember?: ChannelMember;
}

export function RightPanel({ slug, activeTab, onTabChange, members, channel, currentMember }: RightPanelProps) {
  return (
    <div className="flex w-[280px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "pinned" && <PinnedList slug={slug} />}
      {activeTab === "search" && <SearchPanel slug={slug} />}
      {activeTab === "members" && <MemberList members={members} />}
      {activeTab === "settings" && channel && (
        <ChannelSettings channel={channel} currentMember={currentMember} slug={slug} />
      )}
    </div>
  );
}
