import { AlertTriangle, Scale, ShieldAlert, Users } from "lucide-react";
import type { SearchResultDiagnostics } from "../types/patientSimilarity";

interface ResultCohortDiagnosticsPanelProps {
  diagnostics: SearchResultDiagnostics;
}

function fmtPercent(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "\u2014";
  return `${Math.round(value * 100)}%`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "\u2014";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "well_balanced":
      return "Well balanced";
    case "marginal_imbalance":
      return "Marginal imbalance";
    case "significant_imbalance":
      return "Significant imbalance";
    case "not_applicable":
      return "Not applicable";
    default:
      return "Insufficient data";
  }
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "well_balanced":
      return "text-[#2DD4BF]";
    case "marginal_imbalance":
      return "text-[#C9A227]";
    case "significant_imbalance":
      return "text-[#E85A6B]";
    default:
      return "text-[#8A857D]";
  }
}

export function ResultCohortDiagnosticsPanel({
  diagnostics,
}: ResultCohortDiagnosticsPanelProps) {
  const profile = diagnostics.result_profile;
  const balance = diagnostics.balance;
  const warnings = diagnostics.warnings ?? [];
  const coverageEntries = Object.entries(profile.dimension_coverage ?? {})
    .filter(([key]) => key !== "demographics")
    .sort((a, b) => a[0].localeCompare(b[0]));
  const topImbalanced = [...(balance.covariates ?? [])]
    .filter((row) => typeof row.smd === "number")
    .sort((a, b) => Math.abs((b.smd ?? 0)) - Math.abs((a.smd ?? 0)))
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#5A5650]">
            <Users size={12} className="text-[#2DD4BF]" />
            Result Cohort
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-[#C5C0B8]">
            <div>
              <div className="text-[#5A5650]">Returned</div>
              <div className="mt-1 text-sm font-semibold">{profile.result_count ?? 0}</div>
            </div>
            <div>
              <div className="text-[#5A5650]">Median age</div>
              <div className="mt-1 text-sm font-semibold">
                {profile.age_summary?.median_age ?? "\u2014"}
              </div>
            </div>
            <div>
              <div className="text-[#5A5650]">Anchor min</div>
              <div className="mt-1">{fmtDate(profile.anchor_date?.min)}</div>
            </div>
            <div>
              <div className="text-[#5A5650]">Anchor max</div>
              <div className="mt-1">{fmtDate(profile.anchor_date?.max)}</div>
            </div>
          </div>

          {profile.gender_distribution && profile.gender_distribution.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">
                Gender distribution
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.gender_distribution.map((row) => (
                  <span
                    key={row.concept_id}
                    className="inline-flex items-center rounded-md border border-[#2A2A30] bg-[#101014] px-2 py-1 text-xs text-[#C5C0B8]"
                  >
                    {row.label}: {row.count} ({fmtPercent(row.proportion)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#5A5650]">
            <Scale size={12} className="text-[#C9A227]" />
            Coverage
          </div>
          <div className="mt-3 space-y-2">
            {coverageEntries.map(([dimension, coverage]) => (
              <div key={dimension}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="capitalize text-[#C5C0B8]">{dimension}</span>
                  <span className="text-[#8A857D]">{fmtPercent(coverage)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[#232328] overflow-hidden">
                  <div
                    className="h-full bg-[#2DD4BF]"
                    style={{ width: `${Math.max(0, Math.min(100, coverage * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#5A5650]">
            <ShieldAlert size={12} className="text-[#9B1B30]" />
            Balance
          </div>
          <div className="mt-2 space-y-2 text-xs text-[#C5C0B8]">
            <div className={`text-sm font-semibold ${verdictColor(balance.verdict)}`}>
              {verdictLabel(balance.verdict)}
            </div>
            <div>Reference: {balance.reference === "seed_cohort" ? "Seed cohort" : "Single patient"}</div>
            <div>Mean |SMD|: {typeof balance.mean_abs_smd === "number" ? balance.mean_abs_smd.toFixed(3) : "\u2014"}</div>
            <div>Imbalanced covariates: {balance.imbalanced_covariates ?? "\u2014"}</div>
            <div>High imbalance: {balance.high_imbalance_covariates ?? "\u2014"}</div>
          </div>
        </div>
      </div>

      {topImbalanced.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <div className="text-[10px] uppercase tracking-wider text-[#5A5650]">
            Top Imbalanced Covariates
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {topImbalanced.map((row) => (
              <div
                key={row.covariate_name}
                className="rounded-md border border-[#2A2A30] bg-[#101014] px-3 py-2 text-xs text-[#C5C0B8]"
              >
                <div className="font-medium text-[#F0EDE8]">{row.covariate_name}</div>
                <div className="mt-1 text-[#8A857D]">
                  |SMD| {typeof row.smd === "number" ? row.smd.toFixed(3) : "\u2014"}
                </div>
                {typeof row.reference_proportion === "number" && typeof row.result_proportion === "number" && (
                  <div className="mt-1 text-[#8A857D]">
                    Seed {fmtPercent(row.reference_proportion)} · Result {fmtPercent(row.result_proportion)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-[#E85A6B]/20 bg-[#E85A6B]/5 p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#E85A6B]">
            <AlertTriangle size={12} />
            Warnings
          </div>
          <ul className="mt-2 space-y-1 text-sm text-[#F1B6BE]">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
