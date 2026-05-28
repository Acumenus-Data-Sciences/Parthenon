import { cn } from "@/lib/utils";
import type { LibraryStatus } from "../types";

export type StatusTab = LibraryStatus | "all";

interface Props {
  value: StatusTab;
  counts: Record<StatusTab, number>;
  onChange: (v: StatusTab) => void;
  /** Hide a tab whose count is zero. Default keeps all 4 visible. */
  hideEmpty?: boolean;
  className?: string;
}

const TABS: { key: StatusTab; label: string; description: string }[] = [
  { key: "active", label: "Active", description: "Broadly visible" },
  { key: "draft", label: "Drafts", description: "Your private working copies" },
  { key: "archived", label: "Archived", description: "Retired but recoverable" },
  { key: "all", label: "All", description: "Across statuses" },
];

export function StatusTabs({
  value,
  counts,
  onChange,
  hideEmpty = false,
  className,
}: Props) {
  return (
    <div
      role="tablist"
      aria-label="Filter by lifecycle status"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-surface-overlay p-0.5",
        className,
      )}
    >
      {TABS.map((t) => {
        const count = counts[t.key] ?? 0;
        if (hideEmpty && count === 0 && t.key !== value) return null;
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            title={t.description}
            onClick={() => onChange(t.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "bg-surface-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {t.label}
            <span
              className={cn(
                "text-[10px] tabular-nums",
                active ? "text-text-secondary" : "text-text-ghost",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
