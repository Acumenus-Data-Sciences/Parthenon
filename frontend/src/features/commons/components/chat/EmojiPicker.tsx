import { useRef, useEffect } from "react";

const EMOJI_MAP: Record<string, { emoji: string; label: string }> = {
  thumbsup: { emoji: "\ud83d\udc4d", label: "Like" },
  heart: { emoji: "\u2764\ufe0f", label: "Love" },
  laugh: { emoji: "\ud83d\ude02", label: "Haha" },
  surprised: { emoji: "\ud83d\ude2e", label: "Wow" },
  celebrate: { emoji: "\ud83c\udf89", label: "Celebrate" },
  eyes: { emoji: "\ud83d\udc40", label: "Looking" },
};

export const EMOJI_KEYS = Object.keys(EMOJI_MAP);
export const EMOJI_DISPLAY = EMOJI_MAP;

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-lg border border-border bg-card p-1.5 shadow-lg"
    >
      {EMOJI_KEYS.map((key) => (
        <button
          key={key}
          onClick={() => {
            onSelect(key);
            onClose();
          }}
          title={EMOJI_MAP[key].label}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-muted"
        >
          {EMOJI_MAP[key].emoji}
        </button>
      ))}
    </div>
  );
}
