import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { Channel } from "../../types";
import { useUnreadCounts, useDirectMessages } from "../../api";
import { avatarColor } from "../../utils/avatarColor";
import { ChannelSearch } from "./ChannelSearch";
import { CreateChannelModal } from "./CreateChannelModal";

interface ChannelListProps {
  channels: Channel[];
  activeSlug: string;
}

export function ChannelList({ channels, activeSlug }: ChannelListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: unreadCounts = {} } = useUnreadCounts();
  const { data: dms = [] } = useDirectMessages();

  const filtered = useMemo(() => {
    if (!search) return channels;
    const q = search.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, search]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const topicChannels = filtered.filter((c) => c.type === "topic" || c.type === "custom");
  const studyChannels = filtered.filter((c) => c.type === "study");

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 pb-2">
        <ChannelSearch onSearch={setSearch} />
      </div>

      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Channels
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          title="Create channel"
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {topicChannels.map((ch) => (
        <ChannelItem
          key={ch.id}
          channel={ch}
          isActive={ch.slug === activeSlug}
          onClick={() => navigate(`/commons/${ch.slug}`)}
          unreadCount={unreadCounts[ch.slug] ?? 0}
        />
      ))}

      {/* AI Assistant */}
      <SectionLabel>AI Assistant</SectionLabel>
      <button
        onClick={() => navigate("/commons/ask-abby")}
        className={`flex items-center gap-2 py-1.5 px-4 text-[13px] transition-colors ${
          activeSlug === "ask-abby"
            ? "border-l-2 border-emerald-500 bg-emerald-500/15 text-foreground"
            : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <span className="text-emerald-500">✦</span>
        ask-abby
      </button>

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
      {dms.length === 0 ? (
        <p className="px-4 text-xs italic text-muted-foreground/60">
          Click a user to start a conversation
        </p>
      ) : (
        dms.map((dm) => (
          <button
            key={dm.id}
            onClick={() => navigate(`/commons/${dm.slug}`)}
            className={`flex items-center gap-2 py-1.5 px-4 text-[13px] transition-colors border-l-2 ${
              dm.slug === activeSlug
                ? "border-primary bg-primary/15 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            {dm.other_user && (
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                style={{ backgroundColor: avatarColor(dm.other_user.id) }}
              >
                {dm.other_user.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
              </div>
            )}
            <span className="truncate">
              {dm.other_user?.name ?? "Unknown"}
            </span>
          </button>
        ))
      )}

      {showCreateModal && (
        <CreateChannelModal onClose={() => setShowCreateModal(false)} />
      )}
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
