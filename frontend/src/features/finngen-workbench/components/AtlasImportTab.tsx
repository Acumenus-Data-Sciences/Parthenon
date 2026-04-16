// frontend/src/features/finngen-workbench/components/AtlasImportTab.tsx
//
// SP4 Phase E — Atlas tab for ImportCohortsStep. Lists cohort definitions
// from the active WebAPI registry, lets the researcher multi-select and
// import into app.cohort_definitions. Imported rows become visible in the
// Parthenon browse tab immediately (the import endpoint invalidates the
// cohort-search query cache via useQueryClient).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Search,
  Check,
  Download,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { finngenWorkbenchApi } from "../api";

interface AtlasImportTabProps {
  onImportedCohorts: (parthenonCohortIds: number[]) => void;
}

type AtlasCohort = { atlas_id: number; name: string; description?: string | null };

const DEBOUNCE_MS = 200;

export function AtlasImportTab({ onImportedCohorts }: AtlasImportTabProps) {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [lastImportSummary, setLastImportSummary] = useState<string | null>(null);

  useMemo(() => {
    const t = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const atlas = useQuery({
    queryKey: ["finngen", "workbench", "atlas-cohorts"],
    queryFn: () => finngenWorkbenchApi.listAtlasCohorts().then((r) => r.data),
    staleTime: 60_000,
    // Retry once — registry connection hiccups shouldn't nuke the tab.
    retry: 1,
  });

  const importMutation = useMutation({
    mutationFn: (ids: number[]) => finngenWorkbenchApi.importAtlasCohorts(ids).then((r) => r.data),
    onSuccess: (result) => {
      const imported = result.cohorts ?? [];
      setLastImportSummary(
        `Imported ${imported.length} cohort${imported.length === 1 ? "" : "s"}` +
          (result.warnings.length > 0 ? ` · ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}` : "")
      );
      // Make imported cohorts discoverable in the Parthenon tab.
      qc.invalidateQueries({ queryKey: ["finngen", "workbench", "cohort-browse"] });
      qc.invalidateQueries({ queryKey: ["finngen", "workbench", "cohort-search"] });
      const parthenonIds = imported
        .map((c) => (typeof c.id === "number" ? c.id : null))
        .filter((id): id is number => id !== null);
      if (parthenonIds.length > 0) onImportedCohorts(parthenonIds);
      setSelected([]);
    },
  });

  const cohorts: AtlasCohort[] = (atlas.data?.cohorts ?? []) as AtlasCohort[];
  const filtered = debounced === ""
    ? cohorts
    : cohorts.filter((c) => {
        const n = (c.name ?? "").toLowerCase();
        const d = (c.description ?? "").toLowerCase();
        return n.includes(debounced) || d.includes(debounced) || String(c.atlas_id).includes(debounced);
      });

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // 503 (no active registry) is the most common first-time state — surface it
  // with a clear admin CTA rather than a generic error.
  const axiosErr = atlas.error as { response?: { status?: number; data?: { message?: string } } } | null;
  const isNoRegistry = axiosErr?.response?.status === 503;

  if (atlas.isPending) {
    return (
      <div className="flex items-center gap-2 rounded border border-border-default bg-surface-overlay/30 px-3 py-6 text-xs text-text-ghost">
        <Loader2 size={12} className="animate-spin" /> Connecting to active WebAPI registry…
      </div>
    );
  }

  if (isNoRegistry) {
    return (
      <div className="rounded border border-border-default bg-surface-overlay/30 p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-warning">
          <AlertCircle size={14} />
          <span className="font-medium">No active WebAPI registry configured</span>
        </div>
        <p className="text-text-ghost">
          {axiosErr?.response?.data?.message ??
            "Ask an admin to configure a WebAPI registry under Admin → WebAPI Registries, then mark it active."}
        </p>
      </div>
    );
  }

  if (atlas.isError) {
    return (
      <div className="rounded border border-error/40 bg-error/5 p-3 text-xs text-error">
        <AlertCircle size={12} className="inline mr-1" />
        Failed to load Atlas cohorts.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {atlas.data?.registry !== undefined && (
        <div className="flex items-center gap-2 text-[10px] text-text-ghost">
          <span className="uppercase tracking-wide">Registry:</span>
          <span className="font-mono text-text-secondary">{atlas.data.registry.name}</span>
          <a
            href={atlas.data.registry.base_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 hover:text-text-secondary"
          >
            {atlas.data.registry.base_url} <ExternalLink size={8} />
          </a>
        </div>
      )}

      <div className="relative">
        <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-ghost" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`filter ${cohorts.length} atlas cohorts…`}
          className="w-full rounded border border-border-default bg-surface-overlay pl-7 pr-2 py-1.5 text-xs"
        />
      </div>

      <div className="rounded border border-border-default bg-surface-overlay/30 max-h-[24rem] overflow-y-auto">
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-text-ghost">
            {cohorts.length === 0 ? "Registry returned 0 cohort definitions." : `No matches for "${debounced}".`}
          </p>
        )}
        {filtered.length > 0 && (
          <ul>
            {filtered.slice(0, 100).map((c) => (
              <li key={c.atlas_id}>
                <button
                  type="button"
                  onClick={() => toggle(c.atlas_id)}
                  className={[
                    "flex w-full items-center gap-3 border-b border-border-default/40 px-3 py-2 text-left text-xs transition-colors",
                    selected.includes(c.atlas_id) ? "bg-success/10" : "hover:bg-surface-overlay",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      selected.includes(c.atlas_id)
                        ? "border-success bg-success text-bg-canvas"
                        : "border-border-default bg-surface-raised",
                    ].join(" ")}
                  >
                    {selected.includes(c.atlas_id) && <Check size={10} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] text-text-ghost">Atlas #{c.atlas_id}</span>
                      <span className="truncate text-text-primary">{c.name}</span>
                    </span>
                    {c.description !== null && c.description !== undefined && c.description !== "" && (
                      <span className="mt-0.5 block truncate text-[10px] text-text-ghost" title={c.description}>
                        {c.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {filtered.length > 100 && (
          <p className="border-t border-border-default px-3 py-2 text-[10px] text-text-ghost">
            Showing 100 of {filtered.length} matching atlas cohorts — narrow the search to find more.
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
            onClick={() => importMutation.mutate(selected)}
            disabled={selected.length === 0 || importMutation.isPending}
            className={[
              "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
              selected.length === 0 || importMutation.isPending
                ? "bg-surface-overlay text-text-ghost cursor-not-allowed"
                : "bg-success text-bg-canvas hover:bg-success/90",
            ].join(" ")}
          >
            {importMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Import to Parthenon
          </button>
        </div>
      </div>

      {lastImportSummary !== null && !importMutation.isPending && importMutation.isError === false && (
        <div className="flex items-center gap-2 rounded border border-success/40 bg-success/5 px-3 py-2 text-xs text-success">
          <CheckCircle2 size={12} />
          <span>{lastImportSummary}</span>
          <span className="ml-auto text-[10px] text-text-ghost">
            Switch to the Parthenon tab to add them to the tree.
          </span>
        </div>
      )}
      {importMutation.isError && (
        <div className="rounded border border-error/40 bg-error/5 px-3 py-2 text-xs text-error">
          <AlertCircle size={12} className="inline mr-1" />
          Import failed: {(importMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
