import { cn } from "@/lib/utils";

type SimilarityMode = "interpretable" | "embedding";

interface SimilarityModeToggleProps {
  mode: SimilarityMode;
  onChange: (mode: SimilarityMode) => void;
}

export function SimilarityModeToggle({ mode, onChange }: SimilarityModeToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-[#232328] bg-[#0E0E11] overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("interpretable")}
        className={cn(
          "px-3 py-1.5 text-xs font-medium transition-colors",
          mode === "interpretable"
            ? "bg-[#2DD4BF]/10 text-[#2DD4BF] border-r border-[#2DD4BF]/30"
            : "text-[#5A5650] hover:text-[#C5C0B8] border-r border-[#232328]",
        )}
      >
        Interpretable
      </button>
      <button
        type="button"
        onClick={() => onChange("embedding")}
        className={cn(
          "px-3 py-1.5 text-xs font-medium transition-colors",
          mode === "embedding"
            ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
            : "text-[#5A5650] hover:text-[#C5C0B8]",
        )}
      >
        Embedding
      </button>
    </div>
  );
}
