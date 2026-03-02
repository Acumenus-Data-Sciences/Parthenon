import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExplainExpression } from "../hooks/useAbbyAi";

interface AbbyExplainerProps {
  expression: Record<string, unknown>;
}

export function AbbyExplainer({ expression }: AbbyExplainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const explainMutation = useExplainExpression();

  const handleExplain = () => {
    if (explainMutation.isPending) return;

    if (explainMutation.data && isExpanded) {
      setIsExpanded(false);
      return;
    }

    if (explainMutation.data) {
      setIsExpanded(true);
      return;
    }

    explainMutation.mutate(expression, {
      onSuccess: () => setIsExpanded(true),
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleExplain}
        disabled={explainMutation.isPending}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          "text-[#2DD4BF]/70 hover:text-[#2DD4BF]",
          "transition-colors disabled:opacity-50",
        )}
      >
        {explainMutation.isPending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Sparkles size={12} />
        )}
        {explainMutation.data
          ? isExpanded
            ? "Hide explanation"
            : "Show explanation"
          : "Explain this cohort"}
        {explainMutation.data &&
          (isExpanded ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          ))}
      </button>

      {/* Explanation content */}
      {isExpanded && explainMutation.data && (
        <div
          className={cn(
            "rounded-lg border border-[#2DD4BF]/20 bg-[#1C1C20] px-4 py-3",
            "animate-in fade-in slide-in-from-top-1 duration-200",
          )}
        >
          <div className="flex items-start gap-2">
            <Sparkles
              size={14}
              className="text-[#2DD4BF] mt-0.5 shrink-0"
            />
            <p className="text-sm text-[#C5C0B8] leading-relaxed whitespace-pre-wrap">
              {explainMutation.data.explanation}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {explainMutation.isError && (
        <p className="text-xs text-[#E85A6B]">
          {explainMutation.error?.message ?? "Failed to explain cohort"}
        </p>
      )}
    </div>
  );
}
