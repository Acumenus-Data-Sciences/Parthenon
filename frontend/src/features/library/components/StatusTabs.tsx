import type { LibraryStatus } from "../types";

export type StatusTab = LibraryStatus | "all";

interface Props {
  value: StatusTab;
  counts: Record<StatusTab, number>;
  onChange: (v: StatusTab) => void;
}

const TABS: { key: StatusTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All mine" },
];

export function StatusTabs({ value, counts, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-md bg-zinc-900 p-1 ring-1 ring-zinc-800"
      role="tablist"
    >
      {TABS.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={
              "rounded-md px-3 py-1.5 text-sm transition " +
              (active
                ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700"
                : "text-zinc-400 hover:text-zinc-200")
            }
          >
            {t.label}
            <span className="ml-1 text-xs text-zinc-500">
              {counts[t.key] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
