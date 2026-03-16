import { Pin, Search, Users, Settings, ClipboardCheck, Zap } from "lucide-react";
import type { Channel, ChannelMember } from "../../types";
import { PinnedList } from "./PinnedList";
import { SearchPanel } from "./SearchPanel";
import { MemberList } from "./MemberList";
import { ChannelSettings } from "./ChannelSettings";
import { ReviewList } from "./ReviewList";
import { ActivityFeed } from "./ActivityFeed";

const TABS = [
  { key: "activity", label: "Activity", icon: Zap },
  { key: "pinned",   label: "Pinned",   icon: Pin },
  { key: "search",   label: "Search",   icon: Search },
  { key: "reviews",  label: "Reviews",  icon: ClipboardCheck },
  { key: "members",  label: "Members",  icon: Users },
  { key: "settings", label: "Settings", icon: Settings },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface RightPanelProps {
  slug: string;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  members: ChannelMember[];
  channel?: Channel;
  currentMember?: ChannelMember;
}

export function RightPanel({
  slug,
  activeTab,
  onTabChange,
  members,
  channel,
  currentMember,
}: RightPanelProps) {
  return (
    <div className="flex w-[280px] shrink-0 flex-col border-l border-white/[0.04] bg-[#0c0c10]">
      {/* Unified header: channel identity (left) + tab icons (right) */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 min-w-0">
        {/* Channel identity */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {channel ? (
            <>
              <span className="text-[13px] font-semibold text-foreground shrink-0">
                # {channel.name}
              </span>
              {channel.description && (
                <span className="truncate text-[11px] text-muted-foreground">
                  {channel.description}
                </span>
              )}
            </>
          ) : (
            <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
          )}
        </div>

        {/* Tab icon buttons */}
        {channel && (
          <div className="flex shrink-0 items-center gap-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => onTabChange(tab.key)}
                  title={tab.label}
                  className={`flex h-[26px] w-[26px] items-center justify-center rounded transition-colors ${
                    activeTab === tab.key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tab content */}
      {activeTab === "pinned"   && <PinnedList slug={slug} />}
      {activeTab === "search"   && <SearchPanel slug={slug} />}
      {activeTab === "activity" && <ActivityFeed slug={slug} />}
      {activeTab === "reviews"  && <ReviewList slug={slug} />}
      {activeTab === "members"  && <MemberList members={members} />}
      {activeTab === "settings" && channel && (
        <ChannelSettings channel={channel} currentMember={currentMember} slug={slug} />
      )}
    </div>
  );
}
