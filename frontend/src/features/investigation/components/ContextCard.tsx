import type { EvidenceDomain } from "../types";

interface ContextCardProps {
  domain: EvidenceDomain;
  label: string;
  summary: string;
  isActive: boolean;
  onClick: () => void;
}

const DOMAIN_ACCENT: Record<EvidenceDomain, string> = {
  phenotype: "border-teal-400",
  clinical: "border-red-700",
  genomic: "border-yellow-600",
  synthesis: "border-zinc-300",
};

export function ContextCard({
  domain,
  label,
  summary,
  isActive,
  onClick,
}: ContextCardProps) {
  return (
    <button
      onClick={onClick}
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
      <p className="text-sm text-zinc-300 truncate">{summary}</p>
    </button>
  );
}
