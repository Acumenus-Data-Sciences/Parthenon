// frontend/src/features/finngen-workbench/components/ImportCohortsStep.tsx
//
// Step 2 of the Workbench wizard. Two tabs:
//   - Parthenon: browse app.cohort_definitions, multi-select, push to tree.
//   - Atlas:     list cohorts from the active WebAPI registry, import to
//                app.cohort_definitions (SP4 Phase E). Imports become
//                visible in the Parthenon tab immediately.
import { useMemo, useState } from "react";
import { Loader2, Search, Check, Plus, ArrowRight, Database, Globe2 } from "lucide-react";
import { useCohortBrowse, useCohortById, type CohortSummary } from "../hooks/useCohortSearch";
import {
  listCohortIds,
  makeCohort,
  makeOp,
  type OperationNode,
} from "../lib/operationTree";
import { AtlasImportTab } from "./AtlasImportTab";

interface ImportCohortsStepProps {
  tree: OperationNode | null;
  onImport: (next: OperationNode) => void;
  onAdvance: () => void;
}

const DEBOUNCE_MS = 250;
type ImportTab = "parthenon" | "atlas";

export function ImportCohortsStep({ tree, onImport, onAdvance }: ImportCohortsStepProps) {
  const [activeTab, setActiveTab] = useState<ImportTab>("parthenon");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  useMemo(() => {
    const t = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const browse = useCohortBrowse({ search: debounced, perPage: 50 });
  const results = browse.data?.items ?? [];

  // Cohorts already in the tree, so we can badge them as "already imported".
  const alreadyInTree = useMemo(() => new Set(tree ? listCohortIds(tree) : []), [tree]);

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function handleImport(replace: boolean) {
    if (selected.length === 0) return;
    const cohortNodes = selected.map((id) => makeCohort(id));
    let next: OperationNode;
    if (replace || tree === null) {
      // Build a fresh tree from the selected cohorts.
      next = cohortNodes.length === 1 ? cohortNodes[0] : makeOp("UNION", cohortNodes);
    } else if (tree.kind === "op") {
      // Append to the existing root op. Preserves the user's op kind choice.
      next = { ...tree, children: [...tree.children, ...cohortNodes] };
    } else {
      // Root is a single leaf; UNION it with the imported cohorts.
      next = makeOp("UNION", [tree, ...cohortNodes]);
    }
    onImport(next);
    setSelected([]);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <header className="space-y-2">
          <h2 className="text-sm font-semibold text-text-primary">Import cohorts</h2>
          <p className="text-xs text-text-ghost">
            Pull cohorts from Parthenon directly, or import them from an
            OHDSI Atlas instance via the active WebAPI registry.
          </p>
          <div className="flex gap-1 border-b border-border-default pb-px -mb-1">
            <TabButton
              active={activeTab === "parthenon"}
              onClick={() => setActiveTab("parthenon")}
              icon={<Database size={12} />}
              label="Parthenon"
            />
            <TabButton
              active={activeTab === "atlas"}
              onClick={() => setActiveTab("atlas")}
              icon={<Globe2 size={12} />}
              label="Atlas"
            />
          </div>
        </header>

        {activeTab === "atlas" && (
          <AtlasImportTab
            onImportedCohorts={(ids) => {
              // After Atlas imports land, optionally push them straight into the
              // tree as a UNION so the researcher doesn't need to switch tabs
              // + re-select. Uses the same append/replace heuristic as the
              // Parthenon tab's Add-to-tree.
              if (ids.length === 0) return;
              const cohortNodes = ids.map((id) => makeCohort(id));
              let next: OperationNode;
              if (tree === null) {
                next = cohortNodes.length === 1 ? cohortNodes[0] : makeOp("UNION", cohortNodes);
              } else if (tree.kind === "op") {
                next = { ...tree, children: [...tree.children, ...cohortNodes] };
              } else {
                next = makeOp("UNION", [tree, ...cohortNodes]);
              }
              onImport(next);
            }}
          />
        )}

        {activeTab === "parthenon" && (
        <>
        <div className="relative">
          <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-ghost" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search cohorts by name…"
            className="w-full rounded border border-border-default bg-surface-overlay pl-7 pr-2 py-1.5 text-xs"
          />
        </div>

        <div className="rounded border border-border-default bg-surface-overlay/30 max-h-[28rem] overflow-y-auto">
          {browse.isPending && (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-text-ghost">
              <Loader2 size={12} className="animate-spin" /> Loading cohorts…
            </div>
          )}
          {browse.isError && (
            <p className="px-3 py-4 text-xs text-error">Failed to load cohort definitions.</p>
          )}
          {!browse.isPending && results.length === 0 && (
            <p className="px-3 py-4 text-xs text-text-ghost">
              {debounced.trim() === "" ? "No cohort definitions available." : `No matches for "${debounced}".`}
            </p>
          )}
          {results.length > 0 && (
            <ul>
              {results.map((cohort) => (
                <CohortRow
                  key={cohort.id}
                  cohort={cohort}
                  selected={selected.includes(cohort.id)}
                  alreadyInTree={alreadyInTree.has(cohort.id)}
                  onToggle={() => toggle(cohort.id)}
                />
              ))}
            </ul>
          )}
          {browse.data !== undefined && browse.data.total > results.length && (
            <p className="border-t border-border-default px-3 py-2 text-[10px] text-text-ghost">
              Showing {results.length} of {browse.data.total}. Refine the search to narrow.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-text-ghost">
            {selected.length} selected
            {selected.length > 0 && (
              <span className="ml-2 text-text-secondary">({selected.map((id) => `#${id}`).join(", ")})</span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleImport(true)}
              disabled={selected.length === 0}
              className={[
                "inline-flex items-center gap-1 rounded border border-border-default bg-surface-overlay px-2 py-1 text-[11px] font-medium transition-colors",
                selected.length === 0
                  ? "text-text-ghost cursor-not-allowed"
                  : "text-text-secondary hover:bg-surface-raised",
              ].join(" ")}
              title="Replace the current tree with the selected cohorts"
            >
              Replace tree
            </button>
            <button
              type="button"
              onClick={() => handleImport(false)}
              disabled={selected.length === 0}
              className={[
                "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
                selected.length === 0
                  ? "bg-surface-overlay text-text-ghost cursor-not-allowed"
                  : "bg-success text-bg-canvas hover:bg-success/90",
              ].join(" ")}
            >
              <Plus size={12} /> Add to tree
            </button>
          </div>
        </div>
        </>
        )}
      </div>

      {tree !== null && (
        <div className="rounded border border-border-default bg-surface-overlay/30 px-4 py-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-text-ghost">Current tree preview</p>
          <TreePreview tree={tree} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-1 rounded bg-success/10 px-2.5 py-1 text-xs font-medium text-success hover:bg-success/20 transition-colors"
            >
              Go to Operate <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CohortRow({
  cohort,
  selected,
  alreadyInTree,
  onToggle,
}: {
  cohort: CohortSummary;
  selected: boolean;
  alreadyInTree: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={[
          "flex w-full items-center gap-3 border-b border-border-default/40 px-3 py-2 text-left text-xs transition-colors",
          selected ? "bg-success/10" : "hover:bg-surface-overlay",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
            selected ? "border-success bg-success text-bg-canvas" : "border-border-default bg-surface-raised",
          ].join(" ")}
        >
          {selected && <Check size={10} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] text-text-ghost">#{cohort.id}</span>
            <span className="truncate text-text-primary">{cohort.name}</span>
            {alreadyInTree && (
              <span className="ml-auto shrink-0 rounded bg-info/15 px-1.5 text-[9px] text-info">
                in tree
              </span>
            )}
          </span>
          {cohort.description !== null && cohort.description !== undefined && cohort.description !== "" && (
            <span className="mt-0.5 block truncate text-[10px] text-text-ghost" title={cohort.description}>
              {cohort.description}
            </span>
          )}
        </span>
        {cohort.latest_generation?.person_count !== null &&
          cohort.latest_generation?.person_count !== undefined && (
            <span className="shrink-0 text-right text-[10px] font-mono text-text-ghost">
              {cohort.latest_generation.person_count.toLocaleString()} subj
            </span>
          )}
      </button>
    </li>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-t border-b-2 px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-success text-success"
          : "border-transparent text-text-ghost hover:text-text-secondary",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Shallow tree preview — cohort chips grouped under the root op, one level deep.
function TreePreview({ tree }: { tree: OperationNode }) {
  if (tree.kind === "cohort") {
    return <CohortChipLite id={tree.cohort_id} />;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded border border-border-default bg-surface-raised px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-text-secondary">
        {tree.op}
      </span>
      <span className="text-text-ghost">(</span>
      {tree.children.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1.5">
          {c.kind === "cohort" ? (
            <CohortChipLite id={c.cohort_id} />
          ) : (
            <span className="rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-ghost">
              {c.op}(…)
            </span>
          )}
          {i < tree.children.length - 1 && <span className="text-text-ghost">,</span>}
        </span>
      ))}
      <span className="text-text-ghost">)</span>
    </div>
  );
}

function CohortChipLite({ id }: { id: number }) {
  const { data } = useCohortById(id);
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border-default bg-surface-overlay px-1.5 py-0.5 text-[10px]">
      <span className="font-mono text-text-ghost">#{id}</span>
      {data?.name !== undefined && (
        <span className="max-w-[140px] truncate text-text-secondary">{data.name}</span>
      )}
    </span>
  );
}
