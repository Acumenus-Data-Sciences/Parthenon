import { Pin, FileText, Search, Users } from "lucide-react";
import type { ChannelMember } from "../../types";
import { PinnedList } from "./PinnedList";
import { SearchPanel } from "./SearchPanel";
import { MemberList } from "./MemberList";

const TABS = [
  { key: "pinned", label: "Pinned", icon: Pin },
  { key: "search", label: "Search", icon: Search },
  { key: "members", label: "Members", icon: Users },
  { key: "files", label: "Files", icon: FileText },
] as const;

interface RightPanelProps {
  slug: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  members: ChannelMember[];
}

export function RightPanel({ slug, activeTab, onTabChange, members }: RightPanelProps) {
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
      {activeTab === "files" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-[13px] font-medium text-muted-foreground">Shared Files</p>
          <p className="text-xs text-muted-foreground/60">Coming in a future update</p>
        </div>
      )}
    </div>
  );
}
