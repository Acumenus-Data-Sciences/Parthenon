import { useState } from "react";
import { Dna, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePhenotypeDiscovery } from "../hooks/usePatientSimilarity";
import type {
  PhenotypeClusterProfile,
  PhenotypeClusterFeature,
  PhenotypeHeatmapRow,
  PhenotypeDiscoveryResult,
} from "../types/patientSimilarity";

interface PhenotypeDiscoveryProps {
  sourceId: number;
  cohortDefinitionId: number;
}

const CLUSTER_COLORS = [
  "#9B1B30", "#2DD4BF", "#C9A227", "#6366F1", "#F97316",
  "#EC4899", "#14B8A6", "#8B5CF6", "#EF4444", "#22D3EE",
];

function FeatureBar({ feature, color }: { feature: PhenotypeClusterFeature; color: string }) {
  const pct = Math.round(feature.prevalence * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 truncate text-[#C5C0B8]" title={feature.name}>
        {feature.name}
      </span>
      <div className="flex-1 h-3 bg-[#0E0E11] rounded overflow-hidden">
        <div
          className="h-full rounded"
          style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.8 }}
        />
      </div>
      <span className="w-10 text-right text-[#8A857D]">{pct}%</span>
    </div>
  );
}

function ClusterCard({ cluster, index }: { cluster: PhenotypeClusterProfile; index: number }) {
  const color = CLUSTER_COLORS[index % CLUSTER_COLORS.length];
  const genderDist = cluster.demographics.gender_distribution;
  const malePct = Math.round((genderDist.male ?? 0) * 100);
  const femalePct = Math.round((genderDist.female ?? 0) * 100);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#1A1A2E] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h4 className="text-sm font-semibold text-[#F0EDE8]">
            Cluster {cluster.cluster_id + 1}
          </h4>
        </div>
        <span className="text-xs text-[#8A857D]">{cluster.size} patients</span>
      </div>

      {/* Demographics */}
      <div className="flex items-center gap-4 text-xs text-[#8A857D]">
        <span>Age bucket: {cluster.demographics.mean_age_bucket.toFixed(1)}</span>
        <span>M {malePct}% / F {femalePct}%</span>
      </div>

      {/* Top Conditions */}
      {cluster.top_conditions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-[#5A5650]">
            Top Conditions
          </span>
          {cluster.top_conditions.slice(0, 5).map((f) => (
            <FeatureBar key={f.concept_id} feature={f} color="#9B1B30" />
          ))}
        </div>
      )}

      {/* Top Drugs */}
      {cluster.top_drugs.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-[#5A5650]">
            Top Drugs
          </span>
          {cluster.top_drugs.slice(0, 3).map((f) => (
            <FeatureBar key={f.concept_id} feature={f} color="#2DD4BF" />
          ))}
        </div>
      )}
    </div>
  );
}

function prevalenceColor(value: number, featureName: string): string {
  const intensity = Math.min(value, 1.0);
  if (featureName.startsWith("dx_")) {
    return `rgba(155, 27, 48, ${intensity})`;
  }
  if (featureName.startsWith("rx_") || featureName.startsWith("lab_")) {
    return `rgba(45, 212, 191, ${intensity})`;
  }
  return `rgba(201, 162, 39, ${intensity})`;
}

function FeatureHeatmap({
  heatmap,
  nClusters,
}: {
  heatmap: PhenotypeHeatmapRow[];
  nClusters: number;
}) {
  if (heatmap.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">
        Feature Prevalence Heatmap
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left py-1 px-2 text-[#5A5650] font-medium w-48">
              Feature
            </th>
            {Array.from({ length: nClusters }, (_, i) => (
              <th
                key={i}
                className="text-center py-1 px-2 text-[#5A5650] font-medium"
              >
                <div className="flex items-center justify-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                  />
                  C{i + 1}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.map((row) => (
            <tr key={row.feature_name} className="border-t border-[#1A1A2E]">
              <td className="py-1 px-2 text-[#C5C0B8] truncate max-w-[12rem]" title={row.feature_name}>
                {row.feature_name}
              </td>
              {row.cluster_prevalences.map((val, ci) => (
                <td
                  key={ci}
                  className="py-1 px-2 text-center"
                  title={`${(val * 100).toFixed(1)}%`}
                >
                  <div
                    className="mx-auto w-8 h-5 rounded flex items-center justify-center text-[10px]"
                    style={{
                      backgroundColor: prevalenceColor(val, row.feature_name),
                      color: val > 0.4 ? "#F0EDE8" : "#8A857D",
                    }}
                  >
                    {val > 0.01 ? `${Math.round(val * 100)}` : ""}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PhenotypeDiscovery({ sourceId, cohortDefinitionId }: PhenotypeDiscoveryProps) {
  const [method, setMethod] = useState<"consensus" | "kmeans" | "spectral">("consensus");
  const [kOverride, setKOverride] = useState<number | undefined>(undefined);
  const discovery = usePhenotypeDiscovery();
  const result: PhenotypeDiscoveryResult | undefined = discovery.data;

  const handleDiscover = () => {
    discovery.mutate({
      source_id: sourceId,
      cohort_definition_id: cohortDefinitionId,
      method,
      k: kOverride,
    });
  };

  return (
    <div className="space-y-4">
      {/* Trigger section */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-2">
              <Dna size={16} className="text-[#C9A227]" />
              Phenotype Discovery
            </h3>
            <p className="text-xs text-[#5A5650] mt-0.5">
              Discover latent patient subgroups via consensus clustering on clinical features
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "consensus" | "kmeans" | "spectral")}
              className="bg-[#0E0E11] border border-[#232328] text-[#C5C0B8] text-xs rounded px-2 py-1"
            >
              <option value="consensus">Consensus</option>
              <option value="kmeans">K-Means</option>
              <option value="spectral">Spectral</option>
            </select>
            <select
              value={kOverride ?? "auto"}
              onChange={(e) => {
                const v = e.target.value;
                setKOverride(v === "auto" ? undefined : parseInt(v, 10));
              }}
              className="bg-[#0E0E11] border border-[#232328] text-[#C5C0B8] text-xs rounded px-2 py-1"
            >
              <option value="auto">k: auto</option>
              {Array.from({ length: 9 }, (_, i) => i + 2).map((v) => (
                <option key={v} value={v}>k = {v}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleDiscover}
              disabled={discovery.isPending}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded border transition-colors",
                discovery.isPending
                  ? "text-[#5A5650] border-[#232328] cursor-wait"
                  : "text-[#C9A227] border-[#C9A227]/30 hover:bg-[#C9A227]/10 cursor-pointer",
              )}
            >
              {discovery.isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Running {method} clustering...
                </span>
              ) : (
                "Discover Phenotypes"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {discovery.isError && (
        <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-4 py-3">
          <p className="text-sm text-[#E85A6B]">
            Phenotype discovery failed. Ensure the cohort has generated members with feature vectors.
          </p>
        </div>
      )}

      {/* Quality banner */}
      {result && (
        <div className="flex items-center gap-6 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2.5 text-xs">
          <div className="text-[#C5C0B8]">
            <span className="text-[#5A5650]">Silhouette: </span>
            <span className="font-medium">{result.quality.silhouette_score.toFixed(3)}</span>
          </div>
          <div className="text-[#C5C0B8]">
            <span className="text-[#5A5650]">k = </span>
            <span className="font-medium">{result.quality.k_used}</span>
          </div>
          <div className="text-[#C5C0B8]">
            <span className="text-[#5A5650]">Patients: </span>
            <span className="font-medium">{result.feature_matrix_info.n_patients.toLocaleString()}</span>
          </div>
          <div className="text-[#C5C0B8]">
            <span className="text-[#5A5650]">Features: </span>
            <span className="font-medium">{result.feature_matrix_info.n_features.toLocaleString()}</span>
          </div>
          <div className="text-[#C5C0B8]">
            <span className="text-[#5A5650]">Method: </span>
            <span className="font-medium">{result.quality.method}</span>
          </div>
          {result.capped_at && (
            <div className="text-[#C9A227]">
              Capped at {result.capped_at.toLocaleString()} patients
            </div>
          )}
        </div>
      )}

      {/* Cluster summary cards */}
      {result && result.clusters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.clusters.map((cluster, i) => (
            <ClusterCard key={cluster.cluster_id} cluster={cluster} index={i} />
          ))}
        </div>
      )}

      {/* Feature prevalence heatmap */}
      {result && result.heatmap.length > 0 && (
        <FeatureHeatmap heatmap={result.heatmap} nClusters={result.clusters.length} />
      )}
    </div>
  );
}
