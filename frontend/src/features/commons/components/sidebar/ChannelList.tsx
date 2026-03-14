import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Channel } from "../../types";
import { useUnreadCounts } from "../../api";
import { ChannelSearch } from "./ChannelSearch";

interface ChannelListProps {
  channels: Channel[];
  activeSlug: string;
}

export function ChannelList({ channels, activeSlug }: ChannelListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: unreadCounts = {} } = useUnreadCounts();

  const filtered = useMemo(() => {
    if (!search) return channels;
    const q = search.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, search]);

  const topicChannels = filtered.filter((c) => c.type === "topic" || c.type === "custom");
  const studyChannels = filtered.filter((c) => c.type === "study");

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 pb-2">
        <ChannelSearch onSearch={setSearch} />
      </div>

      <SectionLabel>Channels</SectionLabel>
      {topicChannels.map((ch) => (
        <ChannelItem
          key={ch.id}
          channel={ch}
          isActive={ch.slug === activeSlug}
          onClick={() => navigate(`/commons/${ch.slug}`)}
          unreadCount={unreadCounts[ch.slug] ?? 0}
        />
      ))}

      {studyChannels.length > 0 && (
        <>
          <SectionLabel>Study Channels</SectionLabel>
          {studyChannels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={ch.slug === activeSlug}
              onClick={() => navigate(`/commons/${ch.slug}`)}
              unreadCount={unreadCounts[ch.slug] ?? 0}
            />
          ))}
        </>
      )}

      <SectionLabel>Direct Messages</SectionLabel>
      <p className="px-4 text-xs italic text-muted-foreground">Phase 2</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function ChannelItem({
  channel,
  isActive,
  onClick,
  unreadCount = 0,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
  unreadCount?: number;
}) {
  const hasUnread = unreadCount > 0 && !isActive;
  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between py-1.5 px-4 text-[13px] transition-colors ${
        isActive
          ? "border-l-2 border-primary bg-primary/15 text-foreground"
          : hasUnread
            ? "border-l-2 border-transparent text-foreground hover:bg-muted/50"
            : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      <span className={`truncate ${hasUnread ? "font-bold" : ""}`}>
        # {channel.slug}
      </span>
      {hasUnread && (
        <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground min-w-[18px] text-center">
          {displayCount}
        </span>
      )}
    </button>
  );
}
