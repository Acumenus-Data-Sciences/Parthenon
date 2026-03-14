import { Pin, Search, Users, Settings, ClipboardCheck, Zap } from "lucide-react";
import type { Channel, ChannelMember } from "../../types";
import { PinnedList } from "./PinnedList";
import { SearchPanel } from "./SearchPanel";
import { MemberList } from "./MemberList";
import { ChannelSettings } from "./ChannelSettings";
import { ReviewList } from "./ReviewList";
import { ActivityFeed } from "./ActivityFeed";

const TABS = [
  { key: "pinned", label: "Pinned", icon: Pin },
  { key: "search", label: "Search", icon: Search },
  { key: "activity", label: "Activity", icon: Zap },
  { key: "reviews", label: "Reviews", icon: ClipboardCheck },
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
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              title={tab.label}
              className={`flex flex-1 items-center justify-center py-2.5 transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
      {activeTab === "pinned" && <PinnedList slug={slug} />}
      {activeTab === "search" && <SearchPanel slug={slug} />}
      {activeTab === "activity" && <ActivityFeed slug={slug} />}
      {activeTab === "reviews" && <ReviewList slug={slug} />}
      {activeTab === "members" && <MemberList members={members} />}
      {activeTab === "settings" && channel && (
        <ChannelSettings channel={channel} currentMember={currentMember} slug={slug} />
      )}
    </div>
  );
}
