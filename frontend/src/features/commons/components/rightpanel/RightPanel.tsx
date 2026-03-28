import { Pin, Search, Users, Settings, ClipboardCheck, Zap } from "lucide-react";
import type { Channel, ChannelMember, PresenceUser } from "../../types";
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
  presenceUsers?: PresenceUser[];
  channel?: Channel;
  currentMember?: ChannelMember;
}

export function RightPanel({
  slug,
  activeTab,
  onTabChange,
  members,
  presenceUsers = [],
  channel,
  currentMember,
}: RightPanelProps) {
  return (
    <div className="flex w-[396px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#232328] bg-[linear-gradient(180deg,#17171c_0%,#151518_22%,#121216_100%)] shadow-[0_16px_48px_rgba(0,0,0,0.26)]">
      <div className="border-b border-white/[0.06] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.05),transparent_45%),#17171c] px-3 py-3">
        {channel ? (
          <>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                Channel Panel
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="truncate text-[15px] font-semibold text-foreground">
                  # {channel.name}
                </span>
              </div>
              {channel.description && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                  {channel.description}
                </p>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.key;
                return (
                  <button
                    type="button"
                    key={tab.key}
                    onClick={() => onTabChange(tab.key)}
                    title={tab.label}
                    className={`flex items-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-medium transition-colors ${
                      selected
                        ? "border-primary/30 bg-primary/12 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "border-[#26262c] bg-[#121216]/90 text-muted-foreground hover:border-[#31313a] hover:bg-[#18181d] hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-5 w-32 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-4 w-full animate-pulse rounded bg-white/[0.04]" />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]">
        {activeTab === "pinned"   && <PinnedList slug={slug} />}
        {activeTab === "search"   && <SearchPanel slug={slug} />}
        {activeTab === "activity" && <ActivityFeed slug={slug} />}
        {activeTab === "reviews"  && <ReviewList slug={slug} />}
        {activeTab === "members"  && <MemberList members={members} presenceUsers={presenceUsers} />}
        {activeTab === "settings" && channel && (
          <ChannelSettings channel={channel} currentMember={currentMember} slug={slug} />
        )}
      </div>
    </div>
  );
}
