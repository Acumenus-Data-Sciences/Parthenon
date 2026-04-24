import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

const EMOJI_MAP: Record<string, { emoji: string; labelKey: string }> = {
  thumbsup: { emoji: "\ud83d\udc4d", labelKey: "thumbsup" },
  heart: { emoji: "\u2764\ufe0f", labelKey: "heart" },
  laugh: { emoji: "\ud83d\ude02", labelKey: "laugh" },
  surprised: { emoji: "\ud83d\ude2e", labelKey: "surprised" },
  celebrate: { emoji: "\ud83c\udf89", labelKey: "celebrate" },
  eyes: { emoji: "\ud83d\udc40", labelKey: "eyes" },
};

export const EMOJI_KEYS = Object.keys(EMOJI_MAP);
export const EMOJI_DISPLAY = EMOJI_MAP;

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const { t } = useTranslation("commons");
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
          title={t(`chat.emoji.${EMOJI_MAP[key].labelKey}`)}
          aria-label={t(`chat.emoji.${EMOJI_MAP[key].labelKey}`)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-muted"
        >
          {EMOJI_MAP[key].emoji}
        </button>
      ))}
    </div>
  );
}
