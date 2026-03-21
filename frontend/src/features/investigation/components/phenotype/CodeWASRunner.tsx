import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { previewFinnGenCo2Analysis } from "../../api";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import type { FinnGenSource } from "../../types";
import type { CodeWASDisplayResult, Investigation } from "../../types";
import { CodeWASResults } from "./CodeWASResults";

type PinFinding = {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
};

interface CodeWASRunnerProps {
  investigation: Investigation;
  onPinFinding: (finding: PinFinding) => void;
}

function extractCodeWASResult(
  raw: Awaited<ReturnType<typeof previewFinnGenCo2Analysis>>,
  caseName: string,
  controlName: string,
): CodeWASDisplayResult {
  // Pull top_signals from family_segments or family_evidence
  const topSignals: CodeWASDisplayResult["top_signals"] = [];

  if (Array.isArray(raw.family_segments)) {
    for (const seg of raw.family_segments) {
      if (seg.label && seg.count != null) {
        topSignals.push({ label: String(seg.label), count: Number(seg.count) });
      }
    }
  } else if (Array.isArray(raw.family_evidence)) {
    for (const ev of raw.family_evidence) {
      if (ev.label && ev.value != null) {
        topSignals.push({ label: String(ev.label), count: Number(ev.value) });
      }
    }
  }

  // Forest plot from family_spotlight
  const forestPlot: CodeWASDisplayResult["forest_plot"] = [];
  if (Array.isArray(raw.family_spotlight)) {
    for (const sp of raw.family_spotlight) {
      const detail = sp.detail ?? "";
      // Parse "HR 1.23 [0.9, 1.6]" format if present
      const hrMatch = String(detail).match(/HR\s+([\d.]+)\s+\[([\d.]+),\s*([\d.]+)\]/);
      if (hrMatch) {
        forestPlot.push({
          label: String(sp.label ?? ""),
          hr: parseFloat(hrMatch[1]),
          lower: parseFloat(hrMatch[2]),
          upper: parseFloat(hrMatch[3]),
        });
      }
    }
  }

  return {
    top_signals: topSignals,
    analysis_summary: raw.analysis_summary ?? {},
    forest_plot: forestPlot.length > 0 ? forestPlot : undefined,
    case_cohort_name: caseName,
    control_cohort_name: controlName,
  };
}

export function CodeWASRunner({ investigation, onPinFinding }: CodeWASRunnerProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [caseLabel, setCaseLabel] = useState(investigation.title ?? "Case cohort");
  const [controlLabel, setControlLabel] = useState("General population");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CodeWASDisplayResult | null>(null);

  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
    staleTime: 60_000,
  });

  async function handleRun() {
    if (!selectedSourceId) {
      setError("Please select a data source.");
      return;
    }

    const source = sources.find((s) => s.id === selectedSourceId);
    if (!source) {
      setError("Selected source not found.");
      return;
    }

    const finngenSource: FinnGenSource = {
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
      const raw = await previewFinnGenCo2Analysis({
        source: finngenSource,
        module_key: "codewas_preview",
        cohort_label: caseLabel,
        comparator_label: controlLabel,
      });
      setResult(extractCodeWASResult(raw, caseLabel, controlLabel));
    } catch (err) {
      setError(err instanceof Error ? err.message : "CodeWAS analysis failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium text-zinc-200">CodeWAS Validation</h3>
        <p className="text-xs text-zinc-500 mt-0.5">
          Run a code-wide association scan to validate phenotype coverage against your case cohort.
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Source selector */}
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Data Source</label>
          <select
            value={selectedSourceId ?? ""}
            onChange={(e) =>
              setSelectedSourceId(e.target.value ? Number(e.target.value) : null)
            }
            disabled={sourcesLoading}
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#2DD4BF]/60 disabled:opacity-50"
          >
            <option value="">
              {sourcesLoading ? "Loading sources…" : "Select a source…"}
            </option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.source_name}
              </option>
            ))}
          </select>
        </div>

        {/* Case label */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Case Cohort Label</label>
          <input
            type="text"
            value={caseLabel}
            onChange={(e) => setCaseLabel(e.target.value)}
            placeholder="Case cohort name"
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#2DD4BF]/60"
          />
        </div>

        {/* Control label */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">Control Label</label>
          <input
            type="text"
            value={controlLabel}
            onChange={(e) => setControlLabel(e.target.value)}
            placeholder="General population"
            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#2DD4BF]/60"
          />
        </div>
      </div>

      {/* Run button */}
      <div>
        <button
          onClick={() => void handleRun()}
          disabled={isRunning || !selectedSourceId}
          className="flex items-center gap-2 px-4 py-2 rounded bg-[#2DD4BF]/10 border border-[#2DD4BF]/40 text-[#2DD4BF] text-xs font-medium hover:bg-[#2DD4BF]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <svg
                className="w-3.5 h-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
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
              Running CodeWAS…
            </>
          ) : (
            "Run CodeWAS"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded border border-[#9B1B30]/40 bg-red-900/10 px-3 py-2.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-zinc-700/50" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Results</span>
            <div className="h-px flex-1 bg-zinc-700/50" />
          </div>
          <CodeWASResults result={result} onPinFinding={onPinFinding} />
        </div>
      )}

      {/* Empty state */}
      {!result && !isRunning && !error && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-2">
          <svg
            className="w-10 h-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-xs">Select a source and run CodeWAS to see results.</p>
        </div>
      )}
    </div>
  );
}
