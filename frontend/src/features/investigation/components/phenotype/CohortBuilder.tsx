import { useState, useRef } from "react";
import type { Investigation, PhenotypeState, CohortOperationResult } from "../../types";
import { CohortPicker } from "./CohortPicker";
import { PhenotypeLibrarySearch } from "./PhenotypeLibrarySearch";
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
    description: "Browse OHDSI Phenotype Library (1,100+ validated phenotypes)",
  },
];

interface CohortBuilderProps {
  investigation: Investigation;
  onStateChange: (partial: Partial<PhenotypeState>) => void;
  onPinFinding?: (finding: {
    domain: string;
    section: string;
    finding_type: string;
    finding_payload: Record<string, unknown>;
  }) => void;
}

export function CohortBuilder({ investigation, onStateChange, onPinFinding }: CohortBuilderProps) {
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
  const [atlasParseError, setAtlasParseError] = useState<string | null>(null);
  const [atlasSummary, setAtlasSummary] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string; summary: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolved cohort objects (name + count) for CohortOperationPanel
  const { data: cohortListData } = useCohortDefinitions({ limit: 200, with_generations: true });
  const cohortList = cohortListData?.items ?? [];
  const selectedCohorts = selectedIds.map((id) => {
    const def = cohortList.find((c) => c.id === id);
    return {
      id,
      name: def?.name ?? `Cohort #${id}`,
      count: def?.latest_generation?.person_count ?? 0,
    };
  });

  function handleOperationComplete(_result: CohortOperationResult) {
    // TODO: surface operation result in UI
  }

  function handleAtlasParse() {
    setAtlasParseError(null);
    setAtlasSummary(null);
    if (!atlasJson.trim()) {
      setAtlasParseError("Please paste an Atlas JSON definition before parsing.");
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(atlasJson) as Record<string, unknown>;
    } catch {
      setAtlasParseError("Invalid JSON — please check for syntax errors.");
      return;
    }
    const hasExpression = "expression" in parsed;
    const inner = (hasExpression ? (parsed.expression as Record<string, unknown>) : parsed) ?? {};
    const conceptSets = Array.isArray(inner.ConceptSets) ? inner.ConceptSets : [];
    const primaryCriteria = inner.PrimaryCriteria;
    const hasValidShape = "ConceptSets" in inner || "PrimaryCriteria" in inner || hasExpression;
    if (!hasValidShape) {
      setAtlasParseError("Unrecognised format — expected ConceptSets, PrimaryCriteria, or expression keys.");
      return;
    }
    const criteriaCount =
      Array.isArray((primaryCriteria as Record<string, unknown> | undefined)?.CriteriaList)
        ? ((primaryCriteria as Record<string, unknown>).CriteriaList as unknown[]).length
        : primaryCriteria
        ? 1
        : 0;
    setAtlasSummary(
      `Found ${conceptSets.length} concept set${conceptSets.length !== 1 ? "s" : ""}, ${criteriaCount} criteria`
    );
    onStateChange({ cohort_definition: parsed });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeKB = (file.size / 1024).toFixed(1);
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        setFileInfo({ name: file.name, size: `${sizeKB} KB`, summary: "Invalid JSON file" });
        return;
      }
      const inner = ("expression" in parsed ? (parsed.expression as Record<string, unknown>) : parsed) ?? {};
      const conceptSets = Array.isArray(inner.ConceptSets) ? inner.ConceptSets : [];
      setFileInfo({
        name: file.name,
        size: `${sizeKB} KB`,
        summary: `JSON parsed — ${conceptSets.length} concept set${conceptSets.length !== 1 ? "s" : ""}`,
      });
      onStateChange({ cohort_definition: parsed });
    } else if (file.name.endsWith(".csv")) {
      const rows = text.split("\n").filter((r) => r.trim().length > 0);
      const dataRows = rows.length > 1 ? rows.length - 1 : rows.length;
      setFileInfo({
        name: file.name,
        size: `${sizeKB} KB`,
        summary: `Loaded ${dataRows} row${dataRows !== 1 ? "s" : ""} from ${file.name}`,
      });
      onStateChange({ cohort_definition: { csv_rows: rows } });
    } else {
      setFileInfo({ name: file.name, size: `${sizeKB} KB`, summary: "Unsupported file type" });
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handlePhenotypeSelect(phenotype: { id: string; name: string; description: string; expression: Record<string, unknown> }) {
    onStateChange({ cohort_definition: phenotype.expression });
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
              }`}
            >
              <input
                type="radio"
                name="import_mode"
                value={opt.id}
                checked={importMode === opt.id}
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
            onChange={(e) => {
              setAtlasJson(e.target.value);
              setAtlasParseError(null);
              setAtlasSummary(null);
            }}
            rows={10}
            placeholder={'Paste Atlas cohort definition JSON here…\n\n{"ConceptSets": [], "PrimaryCriteria": {...}}'}
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 font-mono focus:outline-none focus:border-[#2DD4BF]/60 resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-zinc-500">
              Export from Atlas: Cohort Definition → Export → JSON
            </p>
            <button
              onClick={handleAtlasParse}
              className="shrink-0 px-3 py-1.5 rounded text-xs font-medium bg-[#2DD4BF]/10 text-[#2DD4BF] border border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/20 transition-colors"
            >
              Parse &amp; Import
            </button>
          </div>
          {atlasParseError && (
            <p className="text-[11px] text-[#9B1B30]">{atlasParseError}</p>
          )}
          {atlasSummary && (
            <p className="text-[11px] text-[#2DD4BF]">{atlasSummary} — imported successfully.</p>
          )}
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          {fileInfo && (
            <div className="rounded border border-zinc-700/50 bg-zinc-800/40 px-3 py-2 flex flex-col gap-0.5">
              <p className="text-xs text-zinc-300 font-medium">{fileInfo.name}</p>
              <p className="text-[11px] text-zinc-500">{fileInfo.size}</p>
              <p className="text-[11px] text-[#2DD4BF]">{fileInfo.summary}</p>
            </div>
          )}
        </div>
      )}

      {importMode === "phenotype_library" && (
        <PhenotypeLibrarySearch onSelectPhenotype={handlePhenotypeSelect} />
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
          onPinFinding={onPinFinding}
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
