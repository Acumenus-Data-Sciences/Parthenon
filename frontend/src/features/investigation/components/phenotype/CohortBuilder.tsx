import { useState } from "react";
import type { Investigation, PhenotypeState, CohortOperationResult } from "../../types";
import { CohortPicker } from "./CohortPicker";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import { CohortOperationPanel } from "./CohortOperationPanel";

type ImportMode = PhenotypeState["import_mode"];

interface ImportOption {
  id: ImportMode;
  label: string;
  description: string;
}

const IMPORT_OPTIONS: ImportOption[] = [
  {
    id: "parthenon",
    label: "Parthenon Cohorts",
    description: "Select from existing cohort definitions",
  },
  {
    id: "json",
    label: "Atlas JSON",
    description: "Paste a cohort definition JSON from Atlas",
  },
  {
    id: "file",
    label: "File Upload",
    description: "Upload a CSV or JSON cohort file",
  },
  {
    id: "phenotype_library",
    label: "Phenotype Library",
    description: "Browse OHDSI phenotype library (coming soon)",
  },
];

interface CohortBuilderProps {
  investigation: Investigation;
  onStateChange: (partial: Partial<PhenotypeState>) => void;
}

export function CohortBuilder({ investigation, onStateChange }: CohortBuilderProps) {
  const [importMode, setImportMode] = useState<ImportMode>(
    investigation.phenotype_state.import_mode ?? "parthenon",
  );
  const [selectedIds, setSelectedIds] = useState<number[]>(
    investigation.phenotype_state.selected_cohort_ids ?? [],
  );
  const [primaryId, setPrimaryId] = useState<number | null>(
    investigation.phenotype_state.primary_cohort_id ?? null,
  );
  const [atlasJson, setAtlasJson] = useState("");

  // Resolved cohort objects (name + count) for CohortOperationPanel
  const { data: cohortListData } = useCohortDefinitions({ limit: 200, with_generations: true });
  const cohortList = cohortListData?.data ?? [];
  const selectedCohorts = selectedIds.map((id) => {
    const def = cohortList.find((c) => c.id === id);
    return {
      id,
      name: def?.name ?? `Cohort #${id}`,
      count: def?.latest_generation?.person_count ?? 0,
    };
  });

  function handleOperationComplete(result: CohortOperationResult) {
    console.log("[CohortBuilder] operation complete:", result);
  }

  function handleModeChange(mode: ImportMode) {
    setImportMode(mode);
    onStateChange({ import_mode: mode });
  }

  function handleSelectionChange(ids: number[]) {
    setSelectedIds(ids);
    onStateChange({ selected_cohort_ids: ids });
  }

  function handlePrimaryChange(id: number | null) {
    setPrimaryId(id);
    onStateChange({ primary_cohort_id: id });
  }

  const conceptSetCount = investigation.phenotype_state.concept_sets?.length ?? 0;

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      {/* Import mode selector */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Import Mode
        </p>
        <div className="grid grid-cols-2 gap-2">
          {IMPORT_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-start gap-2.5 rounded border px-3 py-2.5 cursor-pointer transition-colors ${
                importMode === opt.id
                  ? "border-[#2DD4BF]/50 bg-teal-900/10"
                  : "border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-800/70"
              } ${opt.id === "phenotype_library" ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                name="import_mode"
                value={opt.id}
                checked={importMode === opt.id}
                disabled={opt.id === "phenotype_library"}
                onChange={() => handleModeChange(opt.id)}
                className="mt-0.5 accent-[#2DD4BF] shrink-0"
              />
              <div>
                <span className="text-xs font-medium text-zinc-200">{opt.label}</span>
                <p className="text-[11px] text-zinc-500 mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Mode-specific content */}
      {importMode === "parthenon" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Select Cohorts
          </p>
          <CohortPicker
            selectedIds={selectedIds}
            primaryId={primaryId}
            onSelectionChange={handleSelectionChange}
            onPrimaryChange={handlePrimaryChange}
          />
        </div>
      )}

      {importMode === "json" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Atlas JSON
          </p>
          <textarea
            value={atlasJson}
            onChange={(e) => setAtlasJson(e.target.value)}
            rows={10}
            placeholder='Paste Atlas cohort definition JSON here…\n\n{"ConceptSets": [], "PrimaryCriteria": {...}}'
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 font-mono focus:outline-none focus:border-[#2DD4BF]/60 resize-y"
          />
          <p className="text-[11px] text-zinc-500">
            Export from Atlas: Cohort Definition → Export → JSON
          </p>
        </div>
      )}

      {importMode === "file" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            File Upload
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-700 rounded-lg p-8 cursor-pointer hover:border-zinc-600 transition-colors">
            <svg
              className="w-8 h-8 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-xs text-zinc-400">
              Drop a CSV or JSON file here, or click to browse
            </span>
            <input type="file" accept=".csv,.json" className="hidden" />
          </label>
        </div>
      )}

      {importMode === "phenotype_library" && (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-500">
          <svg
            className="w-10 h-10 text-zinc-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="text-xs">OHDSI Phenotype Library browser coming soon.</p>
        </div>
      )}

      {/* Selected cohorts summary */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Selected Cohorts ({selectedIds.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedCohorts.map(({ id, name }) => (
              <span
                key={id}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border ${
                  primaryId === id
                    ? "bg-[#C9A227]/15 text-[#C9A227] border-[#C9A227]/30"
                    : "bg-zinc-800/60 text-zinc-300 border-zinc-700"
                }`}
              >
                {name}
                {primaryId === id && (
                  <span className="text-[10px] text-[#C9A227]">★</span>
                )}
                <button
                  onClick={() => {
                    const next = selectedIds.filter((x) => x !== id);
                    handleSelectionChange(next);
                    if (primaryId === id) handlePrimaryChange(next[0] ?? null);
                  }}
                  className="ml-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                  aria-label="Remove cohort"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {selectedCohorts.length >= 2 && (
        <CohortOperationPanel
          selectedCohorts={selectedCohorts}
          primaryId={primaryId}
          onOperationComplete={handleOperationComplete}
        />
      )}

      {/* Concept sets from Explore tab */}
      {conceptSetCount > 0 && (
        <div className="rounded border border-zinc-700/50 bg-zinc-800/30 px-3 py-2.5">
          <p className="text-xs text-zinc-400">
            <span className="text-[#2DD4BF] font-medium">{conceptSetCount} concept set{conceptSetCount !== 1 ? "s" : ""}</span>{" "}
            built in the Explore tab will be included in cohort generation.
          </p>
        </div>
      )}
    </div>
  );
}
