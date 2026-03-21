import type { EvidenceDomain } from "../types";

interface ContextCardProps {
  domain: EvidenceDomain;
  label: string;
  summary: string;
  /** Optional rich node to render instead of the plain summary string. */
  summaryNode?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const DOMAIN_ACCENT: Record<EvidenceDomain, string> = {
  phenotype: "border-teal-400",
  clinical: "border-red-700",
  genomic: "border-yellow-600",
  synthesis: "border-zinc-300",
};

/** Extract a leading integer from a summary string, e.g. "3 concept sets" → [3, "concept sets"]. */
function parseLeadingNumber(text: string): [number, string] | null {
  const match = /^(\d+)\s+(.+)$/.exec(text);
  if (!match) return null;
  return [parseInt(match[1], 10), match[2]];
}

export function ContextCard({
  domain,
  label,
  summary,
  summaryNode,
  isActive,
  onClick,
}: ContextCardProps) {
  // Build enhanced summary node when no custom summaryNode is provided
  const displayContent = summaryNode ?? (() => {
    const parsed = parseLeadingNumber(summary);
    if (parsed) {
      const [num, rest] = parsed;
      return (
        <span className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-lg font-bold text-zinc-100 shrink-0">{num}</span>
          <span className="text-sm text-zinc-400 truncate">{rest}</span>
        </span>
      );
    }
    return <span className="text-base font-medium text-zinc-300 truncate">{summary}</span>;
  })();

  return (
    <button
      onClick={onClick}
      title={summary}
      aria-pressed={isActive}
      className={[
        "rounded-xl p-3 text-left transition-colors flex-1 min-w-0",
        isActive
          ? `border-l-2 ${DOMAIN_ACCENT[domain]} bg-zinc-800`
          : "border border-zinc-800 bg-zinc-950 hover:bg-zinc-900",
      ].join(" ")}
    >
      <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1 truncate">
        {label}
      </p>
      <div className="truncate">
        {displayContent}
      </div>
    </button>
  );
}
