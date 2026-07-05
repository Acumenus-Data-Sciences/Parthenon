import { GitMerge, Database } from "lucide-react";
import { ForestPlot } from "@/features/estimation/components/ForestPlot";
import { FixtureBanner } from "./FixtureBanner";
import { SectionTitle, StatusPill } from "./ui";
import { num, records, str, toForestEstimate } from "./narrow";

function gateTone(status: string): "ok" | "warn" | "bad" | "muted" {
  if (status === "cleared") return "ok";
  if (status === "triangulation-only") return "muted";
  if (status === "withheld") return "bad";
  return "warn";
}

/**
 * Cross-design triangulation — the study's headline causal figure. Aligns the
 * O (ATO), P (target-trial) and R (IV) estimates per endpoint so their
 * concordance is visible. When every design withholds, that concordant
 * non-identifiability is stated as the finding rather than drawing empty forests.
 */
export function TriangulationView({ data }: { data: Record<string, unknown> }) {
  const designs = records(data.designs);
  const concordance = str(data.concordance);
  const mostCredible = str(data.most_credible);
  const narrative = str(data.narrative);
  const isRealCdm = str(data.data_source) === "cdm";

  const maceEstimates = designs
    .filter((d) => num(d.hr_mace) !== null)
    .map((d, i) => toForestEstimate({ outcome_name: str(d.name), hazard_ratio: d.hr_mace, ci_95_lower: d.mace_lo, ci_95_upper: d.mace_hi }, i));
  const ckdEstimates = designs
    .filter((d) => num(d.hr_ckd) !== null)
    .map((d, i) => toForestEstimate({ outcome_name: str(d.name), hazard_ratio: d.hr_ckd, ci_95_lower: d.ckd_lo, ci_95_upper: d.ckd_hi }, i));
  const anyEstimate = maceEstimates.length > 0 || ckdEstimates.length > 0;

  return (
    <div className="space-y-4">
      <FixtureBanner data={data} />
      {isRealCdm && (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[11px] text-success">
          <Database size={14} className="mt-0.5 shrink-0" />
          <span className="font-semibold uppercase tracking-wide">Real CDM — assembled from the O / P / R results</span>
        </div>
      )}

      <div
        className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
          concordance === "concordant"
            ? "border-success/40 bg-success/10 text-success"
            : "border-warning/40 bg-warning/10 text-warning"
        }`}
      >
        <GitMerge size={15} className="mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold capitalize">{concordance || "—"}</span>
          {mostCredible && (
            <>
              {" · most-credible design: "}
              <span className="font-mono font-semibold">{mostCredible}</span>
            </>
          )}
          {narrative && <p className="mt-1 font-normal text-text-secondary">{narrative}</p>}
        </div>
      </div>

      {designs.length > 0 && (
        <div className="space-y-1.5">
          {designs.map((d, i) => (
            <div key={i} className="flex items-start gap-2 rounded bg-surface-darkest px-2 py-1.5 text-[11px]">
              <StatusPill label={str(d.gate_status) || "—"} tone={gateTone(str(d.gate_status))} />
              <div className="min-w-0">
                <span className="text-text-secondary">{str(d.name)}</span>
                {str(d.reason) && <p className="text-text-muted">{str(d.reason)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {maceEstimates.length > 0 && (
        <div>
          <SectionTitle>MACE — timely vs delayed (by design)</SectionTitle>
          <ForestPlot estimates={maceEstimates} />
        </div>
      )}

      {ckdEstimates.length > 0 && (
        <div>
          <SectionTitle>CKD progression — timely vs delayed (by design)</SectionTitle>
          <ForestPlot estimates={ckdEstimates} />
        </div>
      )}

      {!anyEstimate && (
        <p className="text-[11px] text-text-ghost italic">
          No design produced an estimable effect — the per-design gate status and reasons above are the triangulation result.
        </p>
      )}
    </div>
  );
}
