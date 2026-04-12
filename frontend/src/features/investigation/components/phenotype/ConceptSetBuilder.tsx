import { useConceptCount } from "../../hooks/useConceptSearch";
import type { ConceptSearchResult } from "../../types";

export interface ConceptSetEntry {
  concept: ConceptSearchResult;
  includeDescendants: boolean;
  isExcluded: boolean;
}

interface CountBadgeProps {
  conceptId: number;
}

function CountBadge({ conceptId }: CountBadgeProps) {
  const { data, isLoading } = useConceptCount(conceptId);

  if (isLoading) {
    return (
      <span className="text-[10px] text-text-ghost bg-surface-raised border border-border-default rounded px-1.5 py-0.5">
        …
      </span>
    );
  }

  if (!data) return null;

  return (
    <span className="text-[10px] font-medium text-accent bg-yellow-900/20 border border-yellow-600/30 rounded px-1.5 py-0.5">
      {data.patient_count.toLocaleString()} pts
    </span>
  );
}

interface ConceptRowProps {
  entry: ConceptSetEntry;
  onChange: (updated: ConceptSetEntry) => void;
  onRemove: () => void;
}

function ConceptRow({ entry, onChange, onRemove }: ConceptRowProps) {
  const { concept, includeDescendants, isExcluded } = entry;

  return (
    <div
      className={`rounded border px-3 py-2.5 transition-colors ${
        isExcluded
          ? "border-primary/30 bg-primary/5"
          : "border-border-default/50 bg-surface-raised/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="text-xs font-medium text-text-primary leading-snug">
              {concept.concept_name}
            </span>
            <CountBadge conceptId={concept.concept_id} />
            {isExcluded && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/30 rounded px-1 py-0.5 leading-none">
                Excluded
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDescendants}
                onChange={(e) =>
                  onChange({ ...entry, includeDescendants: e.target.checked })
                }
                className="rounded border-border-hover bg-surface-base text-success focus:ring-[#2DD4BF]/30 h-3 w-3"
              />
              <span className="text-[11px] text-text-muted">
                Include descendants
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isExcluded}
                onChange={(e) =>
                  onChange({ ...entry, isExcluded: e.target.checked })
                }
                className="rounded border-border-hover bg-surface-base text-primary focus:ring-[#9B1B30]/30 h-3 w-3"
              />
              <span className="text-[11px] text-text-muted">Exclude</span>
            </label>
          </div>
          <div className="mt-1 text-[10px] text-text-ghost font-mono">
            ID: {concept.concept_id} &middot; {concept.vocabulary_id} &middot;{" "}
            {concept.domain_id}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 text-text-ghost hover:text-primary transition-colors mt-0.5"
          title="Remove from concept set"
          aria-label="Remove concept"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export interface SavedSetSummary {
  id: string;
  name: string;
  count: number;
}

interface ConceptSetBuilderProps {
  entries: ConceptSetEntry[];
  onEntriesChange: (entries: ConceptSetEntry[]) => void;
  setName: string;
  onSetNameChange: (name: string) => void;
  savedSets: SavedSetSummary[];
  onSwitchSet: (id: string) => void;
  onNewSet: () => void;
}

export function ConceptSetBuilder({
  entries,
  onEntriesChange,
  setName,
  onSetNameChange,
  savedSets,
  onSwitchSet,
  onNewSet,
}: ConceptSetBuilderProps) {
  function handleChange(index: number, updated: ConceptSetEntry) {
    const next = entries.map((e, i) => (i === index ? updated : e));
    onEntriesChange(next);
  }

  function handleRemove(index: number) {
    onEntriesChange(entries.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Set name input + New Set button */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={setName}
          onChange={(e) => onSetNameChange(e.target.value)}
          placeholder="Untitled concept set"
          className="flex-1 min-w-0 bg-surface-base border border-border-default rounded px-2 py-1 text-xs text-text-primary placeholder-text-ghost focus:outline-none focus:border-success/60 focus:ring-1 focus:ring-[#2DD4BF]/20 transition-colors"
        />
        <button
          onClick={onNewSet}
          title="Save current set and create a new one"
          className="shrink-0 px-2 py-1 rounded border border-border-default bg-surface-raised text-[11px] font-medium text-text-secondary hover:bg-surface-accent hover:text-text-primary hover:border-border-hover transition-colors whitespace-nowrap"
        >
          + New Set
        </button>
      </div>

      {/* Set selector dropdown (only shown when there are multiple sets) */}
      {savedSets.length > 1 && (
        <div className="mb-3">
          <select
            value={savedSets.find((s) => s.name === setName)?.id ?? ""}
            onChange={(e) => onSwitchSet(e.target.value)}
            className="w-full bg-surface-base border border-border-default rounded px-2 py-1 text-[11px] text-text-secondary focus:outline-none focus:border-success/60 focus:ring-1 focus:ring-[#2DD4BF]/20 transition-colors cursor-pointer"
          >
            {savedSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.count} concept{s.count !== 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Concept Set
        </span>
        {entries.length > 0 && (
          <span className="text-[10px] text-text-ghost">
            {entries.length} concept{entries.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center rounded border border-dashed border-border-default/50 bg-surface-base/30">
          <p className="text-center text-xs text-text-ghost px-4 leading-relaxed">
            Search for concepts and add them to build your concept set
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-0.5">
          {entries.map((entry, i) => (
            <ConceptRow
              key={entry.concept.concept_id}
              entry={entry}
              onChange={(updated) => handleChange(i, updated)}
              onRemove={() => handleRemove(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
