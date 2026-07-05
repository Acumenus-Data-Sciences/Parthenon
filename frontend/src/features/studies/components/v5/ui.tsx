import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { fmt, num } from "./narrow";

/** Compact metric tile. */
export function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface-darkest rounded p-2">
      <p className="text-[9px] text-text-ghost uppercase tracking-wide">{label}</p>
      <p className="text-sm text-text-primary font-mono">{value}</p>
      {hint && <p className="text-[9px] text-text-ghost mt-0.5">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h5 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">{children}</h5>
  );
}

/**
 * Estimability gate banner for comparative designs (O/P/R). A withheld estimate
 * (failed gate) renders as an explicit withheld state — never a silent number.
 */
export function GateBanner({
  estimable,
  gates,
}: {
  estimable: boolean;
  gates: Record<string, unknown>;
}) {
  const psAuc = num(gates.ps_auc);
  const maxSmd = num(gates.max_smd);
  const equipoise = num(gates.equipoise);
  const nullCentered = gates.null_centered === true;

  if (!estimable) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical/10 px-3 py-2 text-xs text-critical">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">Estimate withheld.</span> One or more estimability gates
          failed — no effect estimate is shown. Diagnostics are reported below for transparency.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[11px] text-success">
      <span className="inline-flex items-center gap-1 font-semibold">
        <CheckCircle2 size={13} /> Estimability gates cleared
      </span>
      {psAuc !== null && <span>PS AUC {fmt(psAuc, 3)}</span>}
      {maxSmd !== null && <span>max |SMD| {fmt(maxSmd, 3)}</span>}
      {equipoise !== null && <span>equipoise {fmt(equipoise, 2)}</span>}
      <span>null {nullCentered ? "centered" : "off-center"}</span>
    </div>
  );
}

/** Small badge with a semantic tone. */
export function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "muted" }) {
  const cls =
    tone === "ok"
      ? "bg-success/10 text-success"
      : tone === "warn"
        ? "bg-warning/10 text-warning"
        : tone === "bad"
          ? "bg-critical/10 text-critical"
          : "bg-info/10 text-info";
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${cls}`}>{label}</span>;
}
