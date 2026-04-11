// ---------------------------------------------------------------------------
// TagSearchModal — full tag browser with search, sort, and multi-select
// ---------------------------------------------------------------------------

import { useState, useMemo } from "react";
import { Search, X, Check } from "lucide-react";

type SortMode = "alpha" | "count" | "selected";

interface TagSearchModalProps {
  tags: string[];
  activeTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
  onClose: () => void;
  facets?: Record<string, number>;
  color?: "teal" | "gold";
}

const COLOR_MAP = {
  teal: {
    activeBg: "bg-success/15",
    activeText: "text-success",
    activeBorder: "border-success/30",
    ring: "ring-success/40",
    accent: "var(--success)",
  },
  gold: {
    activeBg: "bg-accent/20",
    activeText: "text-accent",
    activeBorder: "border-accent/40",
    ring: "ring-accent/40",
    accent: "var(--accent)",
  },
};

export default function TagSearchModal({
  tags,
  activeTags,
  onToggle,
  onClear,
  onClose,
  facets,
  color = "teal",
}: TagSearchModalProps) {
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("selected");

  const colors = COLOR_MAP[color];
  const hasFacets = facets && Object.keys(facets).length > 0;

  const sortedTags = useMemo(() => {
    let filtered = tags;
    if (search) {
      const q = search.toLowerCase();
      filtered = tags.filter((t) => t.toLowerCase().includes(q));
    }

    const sorted = [...filtered];
    switch (sortMode) {
      case "alpha":
        sorted.sort((a, b) => a.localeCompare(b));
        break;
      case "count":
        if (facets) {
          sorted.sort((a, b) => (facets[b] ?? 0) - (facets[a] ?? 0));
        }
        break;
      case "selected":
        sorted.sort((a, b) => {
          const aActive = activeTags.includes(a) ? 0 : 1;
          const bActive = activeTags.includes(b) ? 0 : 1;
          if (aActive !== bActive) return aActive - bActive;
          return a.localeCompare(b);
        });
        break;
    }
    return sorted;
  }, [tags, search, sortMode, facets, activeTags]);

  const sortOptions: Array<{ mode: SortMode; label: string }> = [
    { mode: "selected", label: "Selected first" },
    { mode: "alpha", label: "A-Z" },
    ...(hasFacets ? [{ mode: "count" as SortMode, label: "By count" }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-xl border border-border-default bg-surface-base shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Browse Tags ({tags.length})
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-ghost hover:bg-surface-elevated hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-3 border-b border-border-default px-5 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-ghost" />
            <input
              type="text"
              placeholder="Search tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 bg-surface-raised border border-border-default rounded-lg text-sm text-text-primary placeholder-text-ghost focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center gap-1 border border-border-default rounded-lg overflow-hidden">
            {sortOptions.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={`px-2.5 py-2 text-[11px] font-medium transition-colors ${
                  sortMode === mode
                    ? "bg-surface-elevated text-text-primary"
                    : "text-text-ghost hover:text-text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Active tags summary */}
        {activeTags.length > 0 && (
          <div className="flex items-center justify-between border-b border-border-default px-5 py-2">
            <span className="text-xs text-text-ghost">
              {activeTags.length} selected
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-text-ghost hover:text-text-muted transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Tag grid */}
        <div
          className="overflow-y-auto px-5 py-4"
          style={{ maxHeight: "50vh" }}
        >
          {sortedTags.length === 0 ? (
            <p className="text-sm text-text-ghost text-center py-8">
              No tags match &ldquo;{search}&rdquo;
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedTags.map((tag) => {
                const active = activeTags.includes(tag);
                const count = facets?.[tag];
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggle(tag)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? `${colors.activeBg} ${colors.activeText} ring-1 ${colors.ring}`
                        : "bg-surface-overlay text-text-muted hover:text-text-secondary hover:bg-surface-elevated"
                    }`}
                  >
                    {active && <Check size={12} />}
                    {tag}
                    {count != null && (
                      <span className="text-[10px] opacity-60">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-border-default px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-surface-elevated text-text-primary text-sm font-medium rounded-lg hover:bg-surface-accent transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
