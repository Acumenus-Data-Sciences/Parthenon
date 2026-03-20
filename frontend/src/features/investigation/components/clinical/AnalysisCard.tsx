import * as LucideIcons from "lucide-react";
import type { AnalysisTypeDescriptor, ClinicalAnalysisGroup, ClinicalAnalysisType } from "../../types";

function getIcon(name: string): React.ElementType {
  const icons = LucideIcons as Record<string, React.ElementType>;
  return icons[name] ?? LucideIcons.Box;
}

const GROUP_ACCENT: Record<ClinicalAnalysisGroup, string> = {
  characterize: "#2DD4BF",
  compare: "#9B1B30",
  predict: "#C9A227",
};

interface AnalysisCardProps {
  descriptor: AnalysisTypeDescriptor;
  onSelect: (type: ClinicalAnalysisType) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export function AnalysisCard({
  descriptor,
  onSelect,
  disabled = false,
  disabledReason,
}: AnalysisCardProps) {
  const Icon = getIcon(descriptor.icon);
  const accent = GROUP_ACCENT[descriptor.group];

  return (
    <button
      type="button"
      onClick={() => {
        if (!disabled) onSelect(descriptor.type);
      }}
      disabled={disabled}
      title={disabled && disabledReason ? disabledReason : undefined}
      className={`group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 ${
        disabled
          ? "cursor-default border-zinc-800 bg-zinc-900/50 opacity-60"
          : "cursor-pointer border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
      }`}
    >
      {/* Left border accent */}
      <div
        className="pointer-events-none absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
        style={{ backgroundColor: accent }}
      />

      {/* Header row: icon + estimated time */}
      <div className="flex items-start justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}18` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
        <span className="text-[10px] text-zinc-600">{descriptor.estimatedTime}</span>
      </div>

      {/* Name */}
      <h3 className="text-lg font-semibold leading-snug text-zinc-100">
        {descriptor.name}
      </h3>

      {/* Description — 2 lines max */}
      <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
        {descriptor.description}
      </p>

      {/* Prerequisites */}
      {descriptor.prerequisites.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {descriptor.prerequisites.map((prereq) => (
            <span
              key={prereq}
              className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400"
            >
              {prereq}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
