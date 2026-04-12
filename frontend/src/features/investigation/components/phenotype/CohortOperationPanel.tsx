import { useState, useEffect } from "react";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type { FinnGenSource } from "../../types";
import type { Source } from "@/types/models";
import { executeCohortOperation } from "../../api";
import type { SetOperationType, CohortOperationResult } from "../../types";
import { CohortSizeComparison } from "./CohortSizeComparison";
import VennDiagram from "./VennDiagram";
import type { VennCircle } from "./VennDiagram";
import AttritionFunnel from "./AttritionFunnel";

interface OperationOption {
  id: SetOperationType;
  label: string;
  description: string;
}

const OPERATION_OPTIONS: OperationOption[] = [
  { id: "union", label: "Union", description: "Combine all patients" },
  { id: "intersect", label: "Intersect", description: "Patients in all cohorts" },
  { id: "subtract", label: "Subtract", description: "Patients in primary only" },
];

const CIRCLE_COLORS = ["#2DD4BF", "#9B1B30", "#C9A227"];

export interface CohortOperationPanelProps {
  selectedCohorts: Array<{ id: number; name: string; count: number }>;
  primaryId: number | null;
  onOperationComplete?: (result: CohortOperationResult) => void;
  onPinFinding?: (finding: {
    domain: string;
    section: string;
    finding_type: string;
    finding_payload: Record<string, unknown>;
  }) => void;
}

export function CohortOperationPanel({
  selectedCohorts,
  primaryId,
  onOperationComplete,
  onPinFinding,
}: CohortOperationPanelProps) {
  const [operationType, setOperationType] = useState<SetOperationType>("union");
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CohortOperationResult | null>(null);

  // Load sources on mount
  useEffect(() => {
    let cancelled = false;
    setSourcesLoading(true);
    fetchSources()
      .then((data) => {
        if (!cancelled) {
          setSources(data);
          setSourcesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build Venn circles — up to 3 cohorts
  const vennCircles: VennCircle[] = selectedCohorts.slice(0, 3).map((c, i) => ({
    id: c.id,
    label: c.name.length > 20 ? c.name.slice(0, 19) + "\u2026" : c.name,
    count: c.count,
    color: CIRCLE_COLORS[i],
  }));

  async function handleExecute() {
    if (!selectedSourceId) {
      setError("Please select a CDM source before running.");
      return;
    }

    const source = sources.find((s) => s.id === selectedSourceId);
    if (!source) {
      setError("Selected source not found.");
      return;
    }

    const finnGenSource: FinnGenSource = {
      id: source.id,
      source_name: source.source_name,
      source_key: source.source_key,
      source_dialect: source.source_dialect,
      daimons: source.daimons,
    };

    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await executeCohortOperation(
        finnGenSource,
        selectedCohorts.map((c) => c.id),
        selectedCohorts.map((c) => c.name),
        primaryId,
        operationType,
      );
      setResult(res);
      onOperationComplete?.(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cohort operation failed.");
    } finally {
      setIsRunning(false);
    }
  }

  if (selectedCohorts.length < 2) return null;

  const compileSummaryEntries = result
    ? Object.entries(result.compile_summary).filter(
        ([, v]) => v !== null && v !== undefined && v !== "",
      )
    : [];

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border-default/50 bg-[#0E0E11] p-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-100">Cohort Set Operations</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Combine or contrast {selectedCohorts.length} selected cohorts.
        </p>
      </div>

      {/* 1. Size comparison */}
      <CohortSizeComparison cohorts={selectedCohorts} primaryId={primaryId} />

      {/* 2. Operation selector */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Operation
        </p>
        <div className="flex gap-2 flex-wrap">
          {OPERATION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setOperationType(opt.id)}
              className={`flex flex-col items-start rounded-full border px-4 py-1.5 text-left transition-colors ${
                operationType === opt.id
                  ? "border-[#2DD4BF]/60 bg-teal-900/20 text-[#2DD4BF]"
                  : "border-border-default bg-surface-raised/50 text-zinc-400 hover:border-border-hover hover:text-zinc-300"
              }`}
            >
              <span className="text-xs font-semibold">{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-500">
          {OPERATION_OPTIONS.find((o) => o.id === operationType)?.description}
        </p>
      </div>

      {/* 3. Venn diagram */}
      {vennCircles.length >= 2 && (
        <div className="flex justify-center rounded-lg border border-border-default bg-[#151518] py-4">
          <VennDiagram
            circles={vennCircles}
            operation={operationType}
            resultCount={result?.result_count}
            width={360}
            height={240}
          />
        </div>
      )}

      {/* 4. Source selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-400">CDM Source</label>
        <select
          value={selectedSourceId ?? ""}
          onChange={(e) =>
            setSelectedSourceId(e.target.value ? Number(e.target.value) : null)
          }
          disabled={sourcesLoading}
          className="w-full rounded border border-border-default bg-surface-raised/60 px-3 py-1.5 text-xs text-zinc-200 focus:border-[#2DD4BF]/60 focus:outline-none disabled:opacity-50"
        >
          <option value="">
            {sourcesLoading ? "Loading sources…" : "Select a CDM source…"}
          </option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>
      </div>

      {/* 5. Execute button */}
      <div>
        <button
          onClick={() => void handleExecute()}
          disabled={isRunning || !selectedSourceId}
          className="flex items-center gap-2 rounded px-5 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "#9B1B30" }}
        >
          {isRunning ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Running Operation…
            </>
          ) : (
            "Run Cohort Operation"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-[#9B1B30]/40 bg-red-900/10 px-3 py-2.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* 6. Results */}
      {result && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-surface-accent/50" />
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Results</span>
            <div className="h-px flex-1 bg-surface-accent/50" />
          </div>

          {/* Result count badge */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center rounded-xl border border-[#2DD4BF]/30 bg-teal-900/10 px-6 py-3">
              <span className="text-3xl font-bold tabular-nums text-[#2DD4BF]">
                {result.result_count.toLocaleString()}
              </span>
              <span className="mt-0.5 text-[11px] text-zinc-400">
                {operationType === "union"
                  ? "total unique patients"
                  : operationType === "intersect"
                  ? "patients in all cohorts"
                  : "patients in primary only"}
              </span>
            </div>
            {result.handoff_ready && (
              <span className="rounded border border-[#2DD4BF]/30 bg-teal-900/10 px-2 py-1 text-[11px] text-[#2DD4BF]">
                Handoff ready
              </span>
            )}
          </div>

          {/* Attrition funnel */}
          {result.attrition.length > 0 && (
            <div className="rounded-lg border border-border-default bg-[#151518] p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
                Attrition
              </h4>
              <AttritionFunnel steps={result.attrition} totalLabel="Input Population" />
            </div>
          )}

          {/* Compile summary key-value cards */}
          {compileSummaryEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Compile Summary
              </p>
              <div className="grid grid-cols-2 gap-2">
                {compileSummaryEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded border border-border-default bg-surface-base/60 px-3 py-2"
                  >
                    <p className="text-[10px] text-zinc-500 capitalize">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-zinc-200">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pin to Dossier */}
          <div>
            <button
              disabled={!result || !onPinFinding}
              onClick={() => {
                if (onPinFinding && result) {
                  onPinFinding({
                    domain: "phenotype",
                    section: "phenotype_definition",
                    finding_type: "cohort_summary",
                    finding_payload: {
                      operation_type: result.operation_type,
                      result_count: result.result_count,
                      cohorts: selectedCohorts.map(c => c.name),
                      compile_summary: result.compile_summary,
                    },
                  });
                }
              }}
              className="rounded border border-border-default bg-surface-raised/40 px-4 py-2 text-xs text-zinc-300 transition-colors hover:border-[#C9A227]/50 hover:bg-[#C9A227]/10 hover:text-[#C9A227] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border-default disabled:hover:bg-surface-raised/40 disabled:hover:text-zinc-500"
              title={!onPinFinding ? "Pin not available" : !result ? "Run an operation first" : "Pin this result to the dossier"}
            >
              Pin to Dossier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
