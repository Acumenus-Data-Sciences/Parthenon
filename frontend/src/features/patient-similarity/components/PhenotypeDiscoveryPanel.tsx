import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type {
  PhenotypeDiscoveryResult,
  PhenotypeClusterProfile,
  PhenotypeHeatmapRow,
} from "../types/patientSimilarity";

const CLUSTER_PALETTE = [
  "var(--success)", "var(--accent)", "var(--primary)", "var(--chart-4)", "var(--domain-device)",
  "var(--domain-observation)", "var(--chart-7)", "var(--chart-8)", "var(--info)", "var(--chart-5)",
];

function clusterColor(id: number): string {
  return CLUSTER_PALETTE[id % CLUSTER_PALETTE.length];
}

function silhouetteLabel(
  t: ReturnType<typeof useTranslation<"app">>["t"],
  score: number,
): { text: string; color: string } {
  if (score >= 0.7) return { text: t("patientSimilarity.phenotype.silhouette.strong"), color: "var(--success)" };
  if (score >= 0.5) return { text: t("patientSimilarity.phenotype.silhouette.good"), color: "var(--success)" };
  if (score >= 0.25) return { text: t("patientSimilarity.phenotype.silhouette.fair"), color: "var(--accent)" };
  return { text: t("patientSimilarity.phenotype.silhouette.weak"), color: "var(--primary)" };
}

// ── Cluster Card ─────────────────────────────────────────────────

function ClusterCard({ cluster, totalPatients }: { cluster: PhenotypeClusterProfile; totalPatients: number }) {
  const { t } = useTranslation("app");
  const pct = totalPatients > 0 ? Math.round((cluster.size / totalPatients) * 100) : 0;
  const maleRatio = cluster.demographics.gender_distribution.male ?? 0;
  const femaleRatio = cluster.demographics.gender_distribution.female ?? 0;
  const ageBucket = cluster.demographics.mean_age_bucket;
  const approxAge = Math.round(ageBucket * 5);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: clusterColor(cluster.cluster_id) }}
          />
          <span className="text-sm font-semibold text-text-primary">
            {t("patientSimilarity.phenotype.clusterLabel", {
              index: cluster.cluster_id + 1,
            })}
          </span>
        </div>
        <span className="text-xs text-text-muted">
          {t("patientSimilarity.phenotype.patientsSummary", {
            count: cluster.size.toLocaleString(),
            percent: pct,
          })}
        </span>
      </div>

      {/* Demographics */}
      <div className="flex gap-4 text-xs text-text-muted">
        <span>{t("patientSimilarity.phenotype.ageApprox", { age: approxAge })}</span>
        <span>
          {t("patientSimilarity.phenotype.genderSplit", {
            male: Math.round(maleRatio * 100),
            female: Math.round(femaleRatio * 100),
          })}
        </span>
      </div>

      {/* Top Conditions */}
      {cluster.top_conditions.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider mb-1">
            {t("patientSimilarity.phenotype.topConditions")}
          </h5>
          <div className="space-y-1">
            {cluster.top_conditions.slice(0, 5).map((f) => (
              <div key={f.concept_id} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary truncate mr-2" title={f.name}>{f.name}</span>
                <span className="text-text-muted tabular-nums shrink-0">
                  {Math.round(f.prevalence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Drugs */}
      {cluster.top_drugs.length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider mb-1">
            {t("patientSimilarity.phenotype.topDrugs")}
          </h5>
          <div className="space-y-1">
            {cluster.top_drugs.slice(0, 3).map((f) => (
              <div key={f.concept_id} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary truncate mr-2" title={f.name}>{f.name}</span>
                <span className="text-text-muted tabular-nums shrink-0">
                  {Math.round(f.prevalence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Heatmap ──────────────────────────────────────────────────────

function FeatureHeatmap({ rows, nClusters }: { rows: PhenotypeHeatmapRow[]; nClusters: number }) {
  const { t } = useTranslation("app");
  const maxPrevalence = useMemo(() => {
    let max = 0;
    for (const row of rows) {
      for (const v of row.cluster_prevalences) {
        if (v > max) max = v;
      }
    }
    return max || 1;
  }, [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border-default">
        <h4 className="text-xs font-semibold text-text-primary">
          {t("patientSimilarity.phenotype.featureHeatmap")}
          <span className="ml-2 font-normal text-text-ghost">
            {t("patientSimilarity.phenotype.featureHeatmapSubtitle", {
              count: rows.length,
            })}
          </span>
        </h4>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-overlay border-b border-border-default">
              <th className="px-3 py-2 text-left text-[11px] font-semibold text-text-ghost uppercase tracking-[0.5px] min-w-[200px]">
                {t("patientSimilarity.phenotype.feature")}
              </th>
              {Array.from({ length: nClusters }, (_, i) => (
                <th key={i} className="px-3 py-2 text-center text-[11px] font-semibold text-text-ghost uppercase tracking-[0.5px] min-w-[80px]">
                  <span
                    className="inline-block h-2 w-2 rounded-full mr-1 align-middle"
                    style={{ backgroundColor: clusterColor(i) }}
                  />
                  {t("patientSimilarity.phenotype.clusterLabel", {
                    index: i + 1,
                  })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const label = row.feature_name
                .replace(/^dx_/, "Dx: ")
                .replace(/^rx_/, "Rx: ")
                .replace(/^lab_/, "Lab: ");
              return (
                <tr key={row.feature_name} className="border-b border-border-default/50 hover:bg-surface-overlay/50">
                  <td className="px-3 py-1.5 text-text-secondary truncate max-w-[250px]" title={label}>
                    {label}
                  </td>
                  {row.cluster_prevalences.map((v, ci) => {
                    const intensity = maxPrevalence > 0 ? v / maxPrevalence : 0;
                    return (
                      <td key={ci} className="px-3 py-1.5 text-center">
                        <span
                          className="inline-block rounded px-2 py-0.5 tabular-nums"
                          style={{
                            backgroundColor: `rgba(45, 212, 191, ${intensity * 0.6})`,
                            color: intensity > 0.4 ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          {(v * 100).toFixed(0)}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Panel ───────────────────────────────────────────────────

interface PhenotypeDiscoveryPanelProps {
  result: PhenotypeDiscoveryResult;
  onContinue?: () => void;
}

export function PhenotypeDiscoveryPanel({ result, onContinue }: PhenotypeDiscoveryPanelProps) {
  const { t } = useTranslation("app");
  const { quality, clusters, heatmap, feature_matrix_info } = result;
  const sil = silhouetteLabel(t, quality.silhouette_score);

  const totalPatients = feature_matrix_info.n_patients;

  return (
    <div className="space-y-4 p-4">
      {/* Quality Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border-default bg-sidebar-bg px-4 py-3">
          <p className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider">
            {t("patientSimilarity.phenotype.clusters")}
          </p>
          <p className="text-xl font-bold text-text-primary mt-0.5">{quality.k_used}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-sidebar-bg px-4 py-3">
          <p className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider">
            {t("patientSimilarity.phenotype.silhouetteMetric")}
          </p>
          <p className="text-xl font-bold mt-0.5" style={{ color: sil.color }}>
            {quality.silhouette_score.toFixed(3)}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: sil.color }}>
            {t("patientSimilarity.phenotype.silhouette.separation", {
              label: sil.text,
            })}
          </p>
        </div>
        <div className="rounded-lg border border-border-default bg-sidebar-bg px-4 py-3">
          <p className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider">
            {t("patientSimilarity.phenotype.patients")}
          </p>
          <p className="text-xl font-bold text-text-primary mt-0.5">{totalPatients.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-sidebar-bg px-4 py-3">
          <p className="text-[10px] font-semibold text-text-ghost uppercase tracking-wider">
            {t("patientSimilarity.phenotype.method")}
          </p>
          <p className="text-xl font-bold text-text-primary mt-0.5 capitalize">{quality.method}</p>
          <p className="text-[10px] text-text-ghost mt-0.5">
            {t("patientSimilarity.phenotype.features", {
              count: feature_matrix_info.n_features,
            })}
          </p>
        </div>
      </div>

      {/* Capped warning */}
      {result.capped_at != null && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-2">
          <p className="text-xs text-accent">
            {t("patientSimilarity.phenotype.capped", {
              count: result.capped_at.toLocaleString(),
            })}
          </p>
        </div>
      )}

      {/* Cluster Cards */}
      {clusters.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            {t("patientSimilarity.phenotype.clusterProfiles")}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clusters.map((c) => (
              <ClusterCard key={c.cluster_id} cluster={c} totalPatients={totalPatients} />
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <FeatureHeatmap rows={heatmap} nClusters={quality.k_used} />

      {/* Action bar */}
      <div className="flex items-center justify-end gap-3 border-t border-border-default pt-4">
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md bg-success/20 px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-success/30"
          >
            {t("patientSimilarity.phenotype.continueToNetworkFusion")}
          </button>
        )}
      </div>
    </div>
  );
}
