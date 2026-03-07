import { useState } from "react";
import { Loader2, Download, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureComparisonTable } from "./FeatureComparisonTable";
import { LovePlot } from "@/features/estimation/components/LovePlot";
import type { CovariateBalanceEntry } from "@/features/estimation/types/estimation";
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

function computeSmdFromFeatures(
  targetFeatures: FeatureResult[],
  comparatorFeatures: FeatureResult[],
): CovariateBalanceEntry[] {
  const comparatorMap = new Map<string, FeatureResult>();
  for (const f of comparatorFeatures) {
    comparatorMap.set(f.feature_name, f);
  }

  const entries: CovariateBalanceEntry[] = [];
  for (const tf of targetFeatures) {
    const cf = comparatorMap.get(tf.feature_name);
    if (!cf) continue;

    const p1 = tf.percent / 100;
    const p2 = cf.percent / 100;
    const pooledSd = Math.sqrt(((p1 * (1 - p1)) + (p2 * (1 - p2))) / 2);
    const smd = pooledSd > 0 ? (p1 - p2) / pooledSd : 0;

    entries.push({
      covariate_name: tf.feature_name,
      smd_before: smd,
      smd_after: smd,
      mean_target_before: 0,
      mean_comp_before: 0,
      mean_target_after: 0,
      mean_comp_after: 0,
    });
  }

  return entries.sort((a, b) => Math.abs(b.smd_before) - Math.abs(a.smd_before));
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

  // Compute SMD for Love Plot when comparator exists
  const balanceEntries: CovariateBalanceEntry[] = [];
  if (comparator) {
    for (const ft of featureTypes) {
      const tf = target.features?.[ft];
      const cf = comparator.features?.[ft];
      if (tf && cf) {
        balanceEntries.push(...computeSmdFromFeatures(tf, cf));
      }
    }
    balanceEntries.sort((a, b) => Math.abs(b.smd_before) - Math.abs(a.smd_before));
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {results.map((r) => (
              <div key={r.cohort_id} className="space-y-1">
                <p style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-muted)" }}>
                  {r.cohort_name}
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--primary)" }}>
                  {r.person_count.toLocaleString()}
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 400, color: "var(--text-muted)", marginLeft: "var(--space-1)" }}>
                    persons
                  </span>
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => downloadCSV(results)}
            className="btn btn-secondary btn-sm"
          >
            <Download size={14} />
            Download CSV
          </button>
        </div>
      </div>

      {/* Covariate Balance Love Plot (when comparator present) */}
      {balanceEntries.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Covariate Balance — Standardized Mean Differences
          </h3>
          <div className="flex justify-center">
            <LovePlot data={balanceEntries} />
          </div>
        </div>
      )}

      {/* Feature Type Tabs */}
      {featureTypes.length > 0 && (
        <>
          <div className="tab-bar">
            {featureTypes.map((ft) => (
              <button
                key={ft}
                type="button"
                onClick={() => setActiveTab(ft)}
                className={cn("tab-item", currentTab === ft && "active")}
              >
                {FEATURE_TYPE_LABELS[ft]}
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
