import { useState } from "react";
import { Plus } from "lucide-react";
import type { ReactionSummary } from "../../types";
import { useToggleReaction } from "../../api";
import { EmojiPicker, EMOJI_DISPLAY } from "./EmojiPicker";
import { ReactionTooltip } from "./ReactionTooltip";

interface ReactionPillsProps {
  messageId: number;
  reactions: ReactionSummary;
}

export function ReactionPills({ messageId, reactions }: ReactionPillsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const toggleReaction = useToggleReaction();

  const emojiKeys = Object.keys(reactions);

  function handleToggle(emoji: string) {
    toggleReaction.mutate({ messageId, emoji });
  }

  const hasReactions = emojiKeys.some(
    (key) => reactions[key]?.count > 0 && EMOJI_DISPLAY[key]
  );

  // Don't render anything if there are no reactions (the + button shows via the message action menu)
  if (!hasReactions && !showPicker) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {emojiKeys.map((key) => {
        const entry = reactions[key];
        const display = EMOJI_DISPLAY[key];
        if (!display || entry.count === 0) return null;

        return (
          <div
            key={key}
            className="relative"
            onMouseEnter={() => setHoveredEmoji(key)}
            onMouseLeave={() => setHoveredEmoji(null)}
          >
            <button
              onClick={() => handleToggle(key)}
              disabled={toggleReaction.isPending}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                entry.reacted
                  ? "border-primary/50 bg-primary/20 text-primary-foreground shadow-[0_0_0_1px_rgba(155,27,48,0.12)]"
                  : "border-[#2a2a31] bg-[#17171c] text-muted-foreground hover:border-[#3a3a44] hover:bg-[#1b1b22]"
              }`}
            >
              <span className="text-sm">{display.emoji}</span>
              <span className="font-medium">{entry.count}</span>
            </button>
            {hoveredEmoji === key && <ReactionTooltip users={entry.users} />}
          </div>
        );
      })}

      {/* Add reaction button — only visible when reactions exist */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          aria-label="Add reaction"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#35353d] bg-[#121216] text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:border-[#454550] hover:bg-[#1a1a20] hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
        {showPicker && (
          <EmojiPicker
            onSelect={handleToggle}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
