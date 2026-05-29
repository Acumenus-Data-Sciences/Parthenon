import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { HelpButton } from "@/features/help";
import { useCleanupSuggestions } from "../api/cleanupApi";
import {
  useBulkArchive,
} from "../api/lifecycleApi";
import type { CleanupSuggestion, LibraryEntity } from "../types";

const SECTIONS: {
  title: string;
  prefix: string;
  entity: LibraryEntity;
  detailRoute: (id: number) => string;
}[] = [
  {
    title: "Concept Sets",
    prefix: "concept_set",
    entity: "concept-sets",
    detailRoute: (id) => `/concept-sets/${id}`,
  },
  {
    title: "Cohort Definitions",
    prefix: "cohort_definition",
    entity: "cohort-definitions",
    detailRoute: (id) => `/cohort-definitions/${id}`,
  },
  // Analyses share one "stale" section regardless of subtype — the suggestion
  // table records the specific analysis type but bulk-archive is per-entity,
  // so we offer separate buttons per type if needed in a follow-up. For now
  // the analyses bucket is grouped under a generic header.
];

function formatRelative(isoOrNull: string | null): string {
  if (!isoOrNull) return "—";
  const days = Math.round(
    (Date.now() - new Date(isoOrNull).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 365) return `${days}d ago`;
  return `${Math.round(days / 365)}y ago`;
}

export default function CleanupSuggestionsPage() {
  const { data, isLoading, error } = useCleanupSuggestions();
  const [selected, setSelected] = useState<Record<string, Set<number>>>({});

  const byPrefix = useMemo(() => {
    const map = new Map<string, CleanupSuggestion[]>();
    for (const row of data ?? []) {
      const arr = map.get(row.item_type) ?? [];
      arr.push(row);
      map.set(row.item_type, arr);
    }
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="py-16 text-center text-critical">
        Failed to load cleanup suggestions.
      </p>
    );
  }

  const total = (data ?? []).length;
  if (total === 0) {
    return (
      <div className="space-y-2 py-16 text-center">
        <h1 className="text-2xl font-bold text-text-primary">All clean.</h1>
        <p className="text-sm text-text-muted">
          No library items are stale right now.
        </p>
        <Link
          to="/cohort-definitions"
          className="inline-block text-sm text-info underline"
        >
          Back to cohort definitions
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-text-primary">
            Cleanup Suggestions
          </h1>
          <HelpButton helpKey="library.cleanup" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Items you own that are active but haven't been used or updated in
          90+ days. Archive what you no longer need — it stays recoverable.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const rows = byPrefix.get(section.prefix) ?? [];
        if (rows.length === 0) return null;
        return (
          <Section
            key={section.prefix}
            title={section.title}
            rows={rows}
            entity={section.entity}
            detailRoute={section.detailRoute}
            selected={selected[section.prefix] ?? new Set()}
            onSelectedChange={(next) =>
              setSelected((prev) => ({ ...prev, [section.prefix]: next }))
            }
          />
        );
      })}
    </div>
  );
}

interface SectionProps {
  title: string;
  rows: CleanupSuggestion[];
  entity: LibraryEntity;
  detailRoute: (id: number) => string;
  selected: Set<number>;
  onSelectedChange: (next: Set<number>) => void;
}

function Section({
  title,
  rows,
  entity,
  detailRoute,
  selected,
  onSelectedChange,
}: SectionProps) {
  const bulkArchive = useBulkArchive(entity);
  const ids = rows.map((r) => r.item_id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  const toggleAll = () => {
    onSelectedChange(allSelected ? new Set() : new Set(ids));
  };
  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange(next);
  };

  const handleArchive = () => {
    if (selected.size === 0) return;
    bulkArchive.mutate(Array.from(selected), {
      onSuccess: () => onSelectedChange(new Set()),
    });
  };

  return (
    <section className="rounded-md border border-border-default bg-surface-raised">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <h2 className="text-sm font-semibold text-text-secondary">
          {title} <span className="text-text-muted">· {rows.length}</span>
        </h2>
        <button
          type="button"
          disabled={selected.size === 0 || bulkArchive.isPending}
          onClick={handleArchive}
          className="rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
        >
          {bulkArchive.isPending
            ? "Archiving…"
            : `Archive ${selected.size || ""}`.trim()}
        </button>
      </header>
      <table className="w-full text-sm">
        <thead className="text-xs text-text-ghost">
          <tr>
            <th className="px-4 py-2 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-4 py-2 text-left">Item</th>
            <th className="px-4 py-2 text-left">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.item_type}:${row.item_id}`}
              className="border-t border-border-default/50"
            >
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(row.item_id)}
                  onChange={() => toggleOne(row.item_id)}
                  aria-label={`Select item ${row.item_id}`}
                />
              </td>
              <td className="px-4 py-2">
                <Link
                  to={detailRoute(row.item_id)}
                  className="text-info hover:underline"
                >
                  #{row.item_id}
                </Link>
              </td>
              <td className="px-4 py-2 text-text-muted">
                {formatRelative(row.last_activity_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
