// Phase 16 Plan 05 Task 1 — LegendBand (D-09 placeholder).
//
// Phase 16 ships without LD coloring per D-09. This component reserves the
// legend slot so Phase 16.1 can drop in the LD gradient without restructuring
// the RegionalView layout. Empty/placeholder row — marked aria-hidden since
// there's no information to convey; the data-testid keeps the test surface
// stable.

export function LegendBand(): JSX.Element {
  return (
    <div
      className="flex h-6 items-center justify-center rounded border border-dashed border-border bg-surface/30 text-[10px] text-text-muted"
      aria-hidden="true"
      data-testid="legend-band-placeholder"
    >
      LD coloring available in Phase 16.1
    </div>
  );
}
