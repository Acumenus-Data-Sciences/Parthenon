import { useState } from "react";
import { Loader2, Download, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureComparisonTable } from "./FeatureComparisonTable";
import type {
  AnalysisExecution,
  FeatureType,
  CharacterizationResult,
  FeatureResult,
} from "../types/analysis";

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  demographics: "Demographics",
  conditions: "Conditions",
  drugs: "Drugs",
  procedures: "Procedures",
  measurements: "Measurements",
  visits: "Visits",
};

interface CharacterizationResultsProps {
  execution?: AnalysisExecution | null;
  isLoading?: boolean;
}

function parseResults(
  execution: AnalysisExecution | null | undefined,
): CharacterizationResult[] {
  if (!execution?.result_json) return [];
  const json = execution.result_json;
  if (Array.isArray(json)) return json as CharacterizationResult[];
  if (typeof json === "object" && "results" in json) {
    return (json as { results: CharacterizationResult[] }).results;
  }
  return [];
}

function getAvailableFeatureTypes(
  results: CharacterizationResult[],
): FeatureType[] {
  const types = new Set<FeatureType>();
  for (const r of results) {
    if (r.features) {
      for (const key of Object.keys(r.features)) {
        const features = r.features[key as FeatureType];
        if (features && features.length > 0) {
          types.add(key as FeatureType);
        }
      }
    }
  }
  return Array.from(types);
}

function downloadCSV(results: CharacterizationResult[]) {
  const rows: string[] = [
    "Cohort,Feature Type,Feature Name,Count,Percent",
  ];

  for (const result of results) {
    if (!result.features) continue;
    for (const [type, features] of Object.entries(result.features)) {
      for (const f of features as FeatureResult[]) {
        rows.push(
          `"${result.cohort_name}","${type}","${f.feature_name.replace(/"/g, '""')}",${f.count},${f.percent}`,
        );
      }
    }
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "characterization_results.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function CharacterizationResults({
  execution,
  isLoading,
}: CharacterizationResultsProps) {
  const [activeTab, setActiveTab] = useState<FeatureType | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (!execution || execution.status !== "completed") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          No results available
        </h3>
        <p className="mt-1 text-xs text-[#8A857D]">
          {execution
            ? `Execution status: ${execution.status}`
            : "Execute the analysis to generate results."}
        </p>
        {execution?.fail_message && (
          <p className="mt-2 text-xs text-[#E85A6B] max-w-md text-center">
            {execution.fail_message}
          </p>
        )}
      </div>
    );
  }

  const results = parseResults(execution);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <p className="text-sm text-[#8A857D]">
          Execution completed but no results were returned.
        </p>
      </div>
    );
  }

  const featureTypes = getAvailableFeatureTypes(results);
  const currentTab = activeTab ?? featureTypes[0] ?? null;

  const target = results[0];
  const comparator = results.length > 1 ? results[1] : null;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {results.map((r) => (
              <div key={r.cohort_id} className="space-y-1">
                <p className="text-xs font-medium text-[#8A857D]">
                  {r.cohort_name}
                </p>
                <p className="font-['IBM_Plex_Mono',monospace] text-lg font-bold text-[#2DD4BF]">
                  {r.person_count.toLocaleString()}
                  <span className="text-xs font-normal text-[#8A857D] ml-1">
                    persons
                  </span>
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => downloadCSV(results)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] hover:border-[#323238] transition-colors"
          >
            <Download size={14} />
            Download CSV
          </button>
        </div>
      </div>

      {/* Feature Type Tabs */}
      {featureTypes.length > 0 && (
        <>
          <div className="flex items-center gap-1 border-b border-[#232328]">
            {featureTypes.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setActiveTab(ft)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  currentTab === ft
                    ? "text-[#2DD4BF]"
                    : "text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                {FEATURE_TYPE_LABELS[ft]}
                {currentTab === ft && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2DD4BF]" />
                )}
              </button>
            ))}
          </div>

          {/* Feature Table */}
          {currentTab && target?.features?.[currentTab] && (
            <FeatureComparisonTable
              targetFeatures={target.features[currentTab]}
              comparatorFeatures={
                comparator?.features?.[currentTab]
              }
              targetLabel={target.cohort_name}
              comparatorLabel={comparator?.cohort_name}
            />
          )}
        </>
      )}
    </div>
  );
}
