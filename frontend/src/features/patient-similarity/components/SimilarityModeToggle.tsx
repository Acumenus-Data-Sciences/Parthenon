import { cn } from "@/lib/utils";

type SimilarityMode = "auto" | "interpretable" | "embedding";

interface SimilarityModeToggleProps {
  mode: SimilarityMode;
  onChange: (mode: SimilarityMode) => void;
  recommendedMode?: string;
}

const modes: { value: SimilarityMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "interpretable", label: "Interpretable" },
  { value: "embedding", label: "Embedding" },
];

export function SimilarityModeToggle({ mode, onChange, recommendedMode }: SimilarityModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg border border-border-default bg-surface-base overflow-hidden">
        {modes.map((m, i) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              i < modes.length - 1 && "border-r",
              mode === m.value
                ? "bg-success/10 text-success border-success/30"
                : "text-text-ghost hover:text-text-secondary border-border-default",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === "auto" && recommendedMode && (
        <span className="text-[10px] text-text-ghost">
          will use {recommendedMode}
        </span>
      )}
    </div>
  );
}
