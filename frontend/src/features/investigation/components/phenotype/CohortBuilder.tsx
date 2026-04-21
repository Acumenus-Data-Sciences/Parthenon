import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { Investigation, PhenotypeState } from "../../types";
import { CohortPicker } from "./CohortPicker";
import { PhenotypeLibrarySearch } from "./PhenotypeLibrarySearch";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";

type ImportMode = PhenotypeState["import_mode"];

interface ImportOption {
  id: ImportMode;
  label: string;
  description: string;
}

interface CohortBuilderProps {
  investigation: Investigation;
  onStateChange: (partial: Partial<PhenotypeState>) => void;
  /**
   * Retained in props API for SP2+ compatibility. Currently unused because
   * the CohortOperationPanel (which used to pin findings) was removed in
   * FinnGen SP1 Task D3 along with the old StudyAgent backend.
   */
  onPinFinding?: (finding: {
    domain: string;
    section: string;
    finding_type: string;
    finding_payload: Record<string, unknown>;
  }) => void;
}

export function CohortBuilder({ investigation, onStateChange }: CohortBuilderProps) {
  const { t } = useTranslation("app");
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
  const importOptions: ImportOption[] = [
    {
      id: "parthenon",
      label: t("investigation.phenotype.importModes.parthenon.label"),
      description: t(
        "investigation.phenotype.importModes.parthenon.description",
      ),
    },
    {
      id: "json",
      label: t("investigation.phenotype.importModes.json.label"),
      description: t("investigation.phenotype.importModes.json.description"),
    },
    {
      id: "file",
      label: t("investigation.phenotype.importModes.file.label"),
      description: t("investigation.phenotype.importModes.file.description"),
    },
    {
      id: "phenotype_library",
      label: t("investigation.phenotype.importModes.phenotypeLibrary.label"),
      description: t(
        "investigation.phenotype.importModes.phenotypeLibrary.description",
      ),
    },
  ];

  // Resolved cohort objects (name + count) for display badges
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

  function handleAtlasParse() {
    setAtlasParseError(null);
    setAtlasSummary(null);
    if (!atlasJson.trim()) {
      setAtlasParseError(t("investigation.phenotype.atlas.parseErrorEmpty"));
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(atlasJson) as Record<string, unknown>;
    } catch {
      setAtlasParseError(t("investigation.phenotype.atlas.parseErrorInvalid"));
      return;
    }
    const hasExpression = "expression" in parsed;
    const inner = (hasExpression ? (parsed.expression as Record<string, unknown>) : parsed) ?? {};
    const conceptSets = Array.isArray(inner.ConceptSets) ? inner.ConceptSets : [];
    const primaryCriteria = inner.PrimaryCriteria;
    const hasValidShape = "ConceptSets" in inner || "PrimaryCriteria" in inner || hasExpression;
    if (!hasValidShape) {
      setAtlasParseError(t("investigation.phenotype.atlas.parseErrorShape"));
      return;
    }
    const criteriaCount =
      Array.isArray((primaryCriteria as Record<string, unknown> | undefined)?.CriteriaList)
        ? ((primaryCriteria as Record<string, unknown>).CriteriaList as unknown[]).length
        : primaryCriteria
        ? 1
        : 0;
    setAtlasSummary(
      t("investigation.phenotype.atlas.summary", {
        conceptSets: conceptSets.length,
        criteria: criteriaCount,
      }),
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
        setFileInfo({
          name: file.name,
          size: `${sizeKB} KB`,
          summary: t("investigation.phenotype.file.invalidJson"),
        });
        return;
      }
      const inner = ("expression" in parsed ? (parsed.expression as Record<string, unknown>) : parsed) ?? {};
      const conceptSets = Array.isArray(inner.ConceptSets) ? inner.ConceptSets : [];
      setFileInfo({
        name: file.name,
        size: `${sizeKB} KB`,
        summary: t("investigation.phenotype.file.parsedJson", {
          count: conceptSets.length,
        }),
      });
      onStateChange({ cohort_definition: parsed });
    } else if (file.name.endsWith(".csv")) {
      const rows = text.split("\n").filter((r) => r.trim().length > 0);
      const dataRows = rows.length > 1 ? rows.length - 1 : rows.length;
      setFileInfo({
        name: file.name,
        size: `${sizeKB} KB`,
        summary: t("investigation.phenotype.file.loadedRows", {
          count: dataRows,
          name: file.name,
        }),
      });
      onStateChange({ cohort_definition: { csv_rows: rows } });
    } else {
      setFileInfo({
        name: file.name,
        size: `${sizeKB} KB`,
        summary: t("investigation.phenotype.file.unsupportedType"),
      });
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
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {t("investigation.common.sections.importMode")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {importOptions.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-start gap-2.5 rounded border px-3 py-2.5 cursor-pointer transition-colors ${
                importMode === opt.id
                  ? "border-success/50 bg-success/10"
                  : "border-border-default/50 bg-surface-raised/40 hover:bg-surface-raised/70"
              }`}
            >
              <input
                type="radio"
                name="import_mode"
                value={opt.id}
                checked={importMode === opt.id}
                onChange={() => handleModeChange(opt.id)}
                className="mt-0.5 accent-success shrink-0"
              />
              <div>
                <span className="text-xs font-medium text-text-primary">{opt.label}</span>
                <p className="text-[11px] text-text-ghost mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Mode-specific content */}
      {importMode === "parthenon" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {t("investigation.common.sections.selectCohorts")}
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
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {t("investigation.common.sections.atlasJson")}
          </p>
          <textarea
            value={atlasJson}
            onChange={(e) => {
              setAtlasJson(e.target.value);
              setAtlasParseError(null);
              setAtlasSummary(null);
            }}
            rows={10}
            placeholder={t("investigation.common.placeholders.atlasJson")}
            className="w-full bg-surface-raised/60 border border-border-default rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-ghost font-mono focus:outline-none focus:border-success/60 resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-text-ghost">
              {t("investigation.phenotype.atlas.exportHint")}
            </p>
            <button
              onClick={handleAtlasParse}
              className="shrink-0 px-3 py-1.5 rounded text-xs font-medium bg-success/10 text-success border border-success/30 hover:bg-success/20 transition-colors"
            >
              {t("investigation.common.actions.parseAndImport")}
            </button>
          </div>
          {atlasParseError && (
            <p className="text-[11px] text-primary">{atlasParseError}</p>
          )}
          {atlasSummary && (
            <p className="text-[11px] text-success">
              {t("investigation.phenotype.atlas.importSucceeded", {
                summary: atlasSummary,
              })}
            </p>
          )}
        </div>
      )}

      {importMode === "file" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {t("investigation.common.sections.fileUpload")}
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border-default rounded-lg p-8 cursor-pointer hover:border-border-hover transition-colors">
            <svg
              className="w-8 h-8 text-text-ghost"
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
            <span className="text-xs text-text-muted">
              {t("investigation.phenotype.file.dropPrompt")}
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
            <div className="rounded border border-border-default/50 bg-surface-raised/40 px-3 py-2 flex flex-col gap-0.5">
              <p className="text-xs text-text-secondary font-medium">{fileInfo.name}</p>
              <p className="text-[11px] text-text-ghost">{fileInfo.size}</p>
              <p className="text-[11px] text-success">{fileInfo.summary}</p>
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
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
            {t("investigation.common.sections.selectedCohorts")} ({selectedIds.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedCohorts.map(({ id, name }) => (
              <span
                key={id}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] border ${
                  primaryId === id
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "bg-surface-raised/60 text-text-secondary border-border-default"
                }`}
              >
                {name}
                {primaryId === id && (
                  <span className="text-[10px] text-accent">★</span>
                )}
                <button
                  onClick={() => {
                    const next = selectedIds.filter((x) => x !== id);
                    handleSelectionChange(next);
                    if (primaryId === id) handlePrimaryChange(next[0] ?? null);
                  }}
                  className="ml-1 text-text-ghost hover:text-text-secondary transition-colors"
                  aria-label={t("investigation.common.actions.removeCohort")}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CohortOperationPanel removed in FinnGen SP1 Task D3 — old StudyAgent
          /api/v1/study-agent/finngen-* backend is gone. SP2+ will reintroduce
          cohort set-operations UI on top of the new SP1 foundation hooks at
          @/features/_finngen-foundation. */}

      {/* Concept sets from Explore tab */}
      {conceptSetCount > 0 && (
        <div className="rounded border border-border-default/50 bg-surface-raised/30 px-3 py-2.5">
          <p className="text-xs text-text-muted">
            <span className="text-success font-medium">
              {t("investigation.common.counts.conceptSet", {
                count: conceptSetCount,
              })}
            </span>{" "}
            {t("investigation.phenotype.validation.includeExploreBuild", {
              count: conceptSetCount,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
