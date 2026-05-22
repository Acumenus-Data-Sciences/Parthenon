import { cn } from "@/lib/utils";

// HTML provenance indicator for asset matrix cells and cohort triptych cards.
// Note: not used inside `PicoCanvas`'s SVG — that canvas keeps its own inline
// SVG provenance rendering until a later cleanup phase.
//
// Spec source:
// docs/lineage/design/specs/2026-05-12-studies-design-workbench-redesign.md

export type ProvenanceSource =
  | "protocol"
  | "ai"
  | "manual"
  | "imported"
  | "inferred";

interface ProvenanceDotProps {
  source: ProvenanceSource;
  /** Protocol page number, when source is `protocol` or `imported`. */
  page?: number;
  /** AI confidence (0–1), when source is `ai`. */
  confidence?: number;
  /** Tooltip-only hint shown on hover. */
  hint?: string;
}

const SOURCE_LABEL: Record<ProvenanceSource, string> = {
  protocol: "PROT",
  ai: "AI",
  manual: "MAN",
  imported: "IMP",
  inferred: "INF",
};

const SOURCE_TOOLTIP: Record<ProvenanceSource, string> = {
  protocol: "From uploaded protocol",
  ai: "AI inference",
  manual: "Manual edit",
  imported: "Imported from prior study",
  inferred: "Inferred from intent",
};

const SOURCE_DOT: Record<ProvenanceSource, string> = {
  protocol: "bg-text-secondary",
  ai: "bg-success",
  manual: "bg-text-muted",
  imported: "bg-warning",
  inferred: "bg-text-ghost",
};

function formatMicroLabel(source: ProvenanceSource, page?: number, confidence?: number): string {
  const base = SOURCE_LABEL[source];
  const parts: string[] = [base];
  if (typeof page === "number" && Number.isFinite(page)) {
    parts.push(`p.${page}`);
  }
  if (typeof confidence === "number" && Number.isFinite(confidence)) {
    const clamped = Math.max(0, Math.min(1, confidence));
    parts.push(clamped.toFixed(2));
  }
  return parts.join(" · ");
}

export function ProvenanceDot({
  source,
  page,
  confidence,
  hint,
}: ProvenanceDotProps): JSX.Element {
  const label = formatMicroLabel(source, page, confidence);
  const title = hint ?? SOURCE_TOOLTIP[source];

  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-border-default bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted"
      title={title}
      aria-label={`${title} — ${label}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", SOURCE_DOT[source])} aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
