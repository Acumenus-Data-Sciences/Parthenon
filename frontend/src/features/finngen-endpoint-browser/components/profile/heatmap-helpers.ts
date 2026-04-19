// Phase 18 (Plan 18-06) — D-07 heatmap color scale.
// Positive phi → crimson (#9B1B30); negative phi → teal-400 / #2DD4BF
// (NOT teal-500); |phi| < 0.05 → neutral gray (--surface-raised at 60%).
//
// teal-400 (= #2DD4BF) is mandated by 18-CONTEXT.md D-07 and is the same
// hue as the Parthenon --success token. Tailwind's `teal-500` (#14b8a6) is
// a darker shade and is NOT used for negative phi anywhere in this scale.
// See 18-UI-SPEC.md §Color §Heatmap color scale for the canonical table.
export function getPhiCellClass(phi: number): string {
  if (phi >= 0.5) return "bg-[#9B1B30] text-slate-100";
  if (phi >= 0.2) return "bg-[#9B1B30]/70 text-slate-100";
  if (phi >= 0.05) return "bg-[#9B1B30]/40 text-rose-50";
  if (phi > -0.05) return "bg-[var(--surface-raised)]/60 text-slate-500";
  if (phi > -0.2) return "bg-teal-400/40 text-teal-100";
  if (phi > -0.5) return "bg-teal-400/70 text-slate-950";
  return "bg-teal-400 text-slate-900";
}
