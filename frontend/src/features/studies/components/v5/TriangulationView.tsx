import { GitMerge } from "lucide-react";
import { ForestPlot } from "@/features/estimation/components/ForestPlot";
import { FixtureBanner } from "./FixtureBanner";
import { SectionTitle, StatusPill } from "./ui";
import { records, str, toForestEstimate } from "./narrow";

function gateTone(status: string): "ok" | "warn" | "bad" | "muted" {
  if (status === "cleared") return "ok";
  if (status === "triangulation-only") return "muted";
  if (status === "withheld") return "bad";
  return "warn";
}

/**
 * Cross-design triangulation — the study's headline causal figure. Aligns the
 * O (ATO), P (target-trial) and R (IV) estimates for each endpoint so their
 * concordance is visible, and states the verdict + most-credible design.
 */
export function TriangulationView({ data }: { data: Record<string, unknown> }) {
  const designs = records(data.designs);
  const concordance = str(data.concordance);
  const mostCredible = str(data.most_credible);
  const narrative = str(data.narrative);

  const maceEstimates = designs.map((d, i) =>
    toForestEstimate({ outcome_name: str(d.name), hazard_ratio: d.hr_mace, ci_95_lower: d.mace_lo, ci_95_upper: d.mace_hi }, i),
  );
  const ckdEstimates = designs.map((d, i) =>
    toForestEstimate({ outcome_name: str(d.name), hazard_ratio: d.hr_ckd, ci_95_lower: d.ckd_lo, ci_95_upper: d.ckd_hi }, i),
  );

  return (
    <div className="space-y-4">
      <FixtureBanner data={data} />

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
        <div className="flex flex-wrap gap-2">
          {designs.map((d, i) => (
            <div key={i} className="inline-flex items-center gap-1.5 rounded bg-surface-darkest px-2 py-1 text-[11px] text-text-muted">
              <span className="text-text-secondary">{str(d.name)}</span>
              <StatusPill label={str(d.gate_status) || "—"} tone={gateTone(str(d.gate_status))} />
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
    </div>
  );
}
