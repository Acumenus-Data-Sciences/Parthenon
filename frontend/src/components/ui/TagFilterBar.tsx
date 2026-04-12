// ---------------------------------------------------------------------------
// TagFilterBar — truncated tag pills with "Search Tags" overflow button
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Search, X } from "lucide-react";
import TagSearchModal from "./TagSearchModal";

interface TagFilterBarProps {
  tags: string[];
  activeTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
  facets?: Record<string, number>;
  color?: "teal" | "gold";
  maxVisible?: number;
}

const COLOR_MAP = {
  teal: {
    activePill:
      "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30",
    inactivePill:
      "bg-[#1A1A1F] text-[#8A857D] border border-[#2A2A30] hover:border-[#3A3A42]",
  },
  gold: {
    activePill:
      "bg-[#C9A227]/20 text-[#C9A227] ring-1 ring-[#C9A227]/40",
    inactivePill:
      "bg-[#1C1C20] text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#232328]",
  },
};

export default function TagFilterBar({
  tags,
  activeTags,
  onToggle,
  onClear,
  facets,
  color = "teal",
  maxVisible = 15,
}: TagFilterBarProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (tags.length === 0) return null;

  const colors = COLOR_MAP[color];
  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = Math.max(0, tags.length - maxVisible);

  // Always show active tags even if they're beyond maxVisible
  const activeHidden = activeTags.filter(
    (t) => !visibleTags.includes(t)
  );
  const displayTags = [...visibleTags, ...activeHidden];
  const adjustedHiddenCount = hiddenCount - activeHidden.length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#5A5650]">Filter by tag:</span>

        {displayTags.map((tag) => {
          const active = activeTags.includes(tag);
          const count = facets?.[tag];
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                active ? colors.activePill : colors.inactivePill
              }`}
            >
              {tag}
              {count != null && (
                <span className="text-[10px] opacity-60">({count})</span>
              )}
              {active && <X size={10} />}
            </button>
          );
        })}

        {/* Search tags button — always show when there are hidden tags */}
        {adjustedHiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#232328] text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#2A2A30] transition-colors"
          >
            <Search size={10} />
            {adjustedHiddenCount} more
          </button>
        )}

        {/* Always allow opening modal even when all visible */}
        {adjustedHiddenCount <= 0 && tags.length > 5 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-[#5A5650] hover:text-[#8A857D] transition-colors"
          >
            <Search size={10} />
            Search
          </button>
        )}

        {activeTags.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[#5A5650] hover:text-[#8A857D] transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {modalOpen && (
        <TagSearchModal
          tags={tags}
          activeTags={activeTags}
          onToggle={onToggle}
          onClear={onClear}
          onClose={() => setModalOpen(false)}
          facets={facets}
          color={color}
        />
      )}
    </>
  );
}
