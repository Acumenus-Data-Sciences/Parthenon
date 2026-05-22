import { cn } from "@/lib/utils";

// Asset state-machine status chip used in Asset Matrix rows and Cohort
// Triptych cards. Renders the reached state as a single status chip:
//
//   draft → verified → materialized → linked
//
// The `blocked` flag colors the chip with the error tone — this is the lone
// justified error use in v2 (asset blocked, equivalent to a build error). See
// docs/lineage/design/specs/2026-05-12-studies-design-workbench-redesign.md.

export type PipelineGlyphState = "draft" | "verified" | "materialized" | "linked";

interface PipelineGlyphProps {
  /** Which step the asset has reached. */
  state: PipelineGlyphState;
  /** Optional override — for tooling that needs to render a specific blocked dot. */
  blocked?: boolean;
  /** Size variant — 'sm' for inline table cells, 'md' for triptych cards. */
  size?: "sm" | "md";
}

const STATE_LABEL: Record<PipelineGlyphState, string> = {
  draft: "Draft",
  verified: "Verified",
  materialized: "Materialized",
  linked: "Linked",
};

export function PipelineGlyph({ state, blocked = false, size = "sm" }: PipelineGlyphProps): JSX.Element {
  const label = STATE_LABEL[state];
  const ariaLabel = blocked
    ? `Pipeline blocked at ${label}`
    : `Pipeline reached ${label}`;

  // Tone: blocked → error; draft → neutral; verified/materialized/linked → success.
  const tone = blocked
    ? "border-error/40 bg-error/10 text-error"
    : state === "draft"
      ? "border-border-default bg-surface-elevated text-text-muted"
      : "border-success/40 bg-success/10 text-success";

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
        tone,
      )}
    >
      {label}
    </span>
  );
}
