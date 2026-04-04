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
      <div className="flex items-center rounded-lg border border-[#232328] bg-[#0E0E11] overflow-hidden">
        {modes.map((m, i) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              i < modes.length - 1 && "border-r",
              mode === m.value
                ? "bg-[#2DD4BF]/10 text-[#2DD4BF] border-[#2DD4BF]/30"
                : "text-[#5A5650] hover:text-[#C5C0B8] border-[#232328]",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === "auto" && recommendedMode && (
        <span className="text-[10px] text-[#5A5650]">
          will use {recommendedMode}
        </span>
      )}
    </div>
  );
}
