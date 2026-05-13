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
      className={cn("provenance-dot", source)}
      title={title}
      aria-label={`${title} — ${label}`}
    >
      <span className="dot" aria-hidden="true" />
      <span className="label wb-mono" aria-hidden="true">{label}</span>
    </span>
  );
}
