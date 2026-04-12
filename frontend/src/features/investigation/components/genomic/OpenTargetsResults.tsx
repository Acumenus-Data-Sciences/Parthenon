import type { OpenTargetsSearchHit } from "../../types";

type PinFinding = {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
  gene_symbols?: string[];
};

interface OpenTargetsResultsProps {
  hits: OpenTargetsSearchHit[];
  queryType: "gene" | "disease";
  onPinFinding: (finding: PinFinding) => void;
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 1) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-accent/60 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }}
        />
      </div>
      <span className="text-[10px] text-text-ghost tabular-nums w-8 text-right">
        {score.toFixed(2)}
      </span>
    </div>
  );
}

function GeneCard({
  hit,
  onPinFinding,
}: {
  hit: OpenTargetsSearchHit;
  onPinFinding: (finding: PinFinding) => void;
}) {
  const target = hit.object as {
    approvedSymbol?: string;
    approvedName?: string;
    biotype?: string;
    tractability?: Array<{ modality: string; value: boolean }>;
  };

  const symbol = target.approvedSymbol ?? hit.name;
  const geneName = target.approvedName ?? "";
  const biotype = target.biotype ?? null;
  const tractability = target.tractability ?? [];

  const tractabilityBadges = tractability
    .filter((t) => t.value)
    .map((t) => t.modality);

  function getBadgeStyle(modality: string): string {
    const lower = modality.toLowerCase();
    if (lower.includes("small")) return "border-success/40 text-success";
    if (lower.includes("antibody")) return "border-primary/40 text-primary";
    return "border-border-hover text-text-muted";
  }

  function handlePin() {
    onPinFinding({
      domain: "genomic",
      section: "genomic_evidence",
      finding_type: "open_targets_association",
      finding_payload: {
        hit_id: hit.id,
        approved_symbol: symbol,
        approved_name: geneName,
        biotype,
        score: hit.score,
        tractability: tractabilityBadges,
        source: "open_targets",
      },
      gene_symbols: [symbol],
    });
  }

  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-surface-base/50 border border-border-default hover:border-border-default transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-bold truncate" style={{ color: "var(--success)" }}>
            {symbol}
          </span>
          {geneName && (
            <span className="text-xs text-text-muted leading-snug line-clamp-2">{geneName}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {biotype && (
            <span className="text-[10px] px-2 py-0.5 rounded border border-border-default text-text-ghost">
              {biotype}
            </span>
          )}
          <button
            onClick={handlePin}
            className="text-[10px] px-2.5 py-1 rounded border border-border-hover text-text-muted hover:border-accent/50 hover:text-accent transition-colors whitespace-nowrap"
          >
            Pin
          </button>
        </div>
      </div>

      {tractabilityBadges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tractabilityBadges.map((m) => (
            <span
              key={m}
              className={`text-[10px] px-2 py-0.5 rounded border ${getBadgeStyle(m)}`}
            >
              {m}
            </span>
          ))}
        </div>
      )}

      <ScoreBar score={hit.score} />
    </div>
  );
}

function DiseaseCard({
  hit,
  onPinFinding,
}: {
  hit: OpenTargetsSearchHit;
  onPinFinding: (finding: PinFinding) => void;
}) {
  const disease = hit.object as {
    id?: string;
    name?: string;
    description?: string;
    therapeuticAreas?: Array<{ name: string }>;
  };

  const name = disease.name ?? hit.name;
  const description = disease.description ?? null;
  const therapeuticAreas = disease.therapeuticAreas ?? [];

  function handlePin() {
    onPinFinding({
      domain: "genomic",
      section: "genomic_evidence",
      finding_type: "open_targets_association",
      finding_payload: {
        hit_id: hit.id,
        disease_name: name,
        description,
        therapeutic_areas: therapeuticAreas.map((a) => a.name),
        score: hit.score,
        source: "open_targets",
        concept_ids: [],
      },
    });
  }

  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-xl bg-surface-base/50 border border-border-default hover:border-border-default transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-sm font-bold leading-snug" style={{ color: "var(--primary)" }}>
            {name}
          </span>
          {description && (
            <span className="text-xs text-text-muted leading-snug line-clamp-2">{description}</span>
          )}
        </div>
        <button
          onClick={handlePin}
          className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded border border-border-hover text-text-muted hover:border-accent/50 hover:text-accent transition-colors whitespace-nowrap"
        >
          Pin
        </button>
      </div>

      {therapeuticAreas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {therapeuticAreas.map((area) => (
            <span
              key={area.name}
              className="text-[10px] px-2 py-0.5 rounded border border-border-default text-text-muted"
            >
              {area.name}
            </span>
          ))}
        </div>
      )}

      <ScoreBar score={hit.score} />
    </div>
  );
}

export function OpenTargetsResults({
  hits,
  queryType,
  onPinFinding,
}: OpenTargetsResultsProps) {
  if (hits.length === 0) {
    return (
      <p className="text-xs text-text-ghost py-4 text-center">No results found.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[10px] text-text-ghost uppercase tracking-wide">
        {hits.length} result{hits.length !== 1 ? "s" : ""} — Open Targets Platform
      </p>
      {hits.map((hit) =>
        queryType === "gene" ? (
          <GeneCard key={hit.id} hit={hit} onPinFinding={onPinFinding} />
        ) : (
          <DiseaseCard key={hit.id} hit={hit} onPinFinding={onPinFinding} />
        ),
      )}
    </div>
  );
}
