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
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                entry.reacted
                  ? "border border-primary/50 bg-primary/20 text-primary-foreground"
                  : "border border-border bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className="text-sm">{display.emoji}</span>
              <span>{entry.count}</span>
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
          className="inline-flex h-6 w-7 items-center justify-center rounded-full border border-dashed border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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
