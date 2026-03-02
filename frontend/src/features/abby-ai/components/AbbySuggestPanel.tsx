import { useState } from "react";
import { X, Sparkles, Loader2, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSuggestCriteria } from "../hooks/useAbbyAi";

interface AbbySuggestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (conceptId: number, conceptName: string) => void;
  domain?: string;
}

const DOMAINS = [
  { value: "condition", label: "Condition" },
  { value: "drug", label: "Drug" },
  { value: "procedure", label: "Procedure" },
  { value: "measurement", label: "Measurement" },
  { value: "observation", label: "Observation" },
];

const DOMAIN_COLORS: Record<string, string> = {
  condition: "bg-[#E85A6B]/15 text-[#E85A6B]",
  drug: "bg-[#2DD4BF]/15 text-[#2DD4BF]",
  procedure: "bg-[#A78BFA]/15 text-[#A78BFA]",
  measurement: "bg-[#C9A227]/15 text-[#C9A227]",
  observation: "bg-[#60A5FA]/15 text-[#60A5FA]",
};

export function AbbySuggestPanel({
  isOpen,
  onClose,
  onSelect,
  domain: initialDomain,
}: AbbySuggestPanelProps) {
  const [selectedDomain, setSelectedDomain] = useState(
    initialDomain ?? "condition",
  );
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const suggestMutation = useSuggestCriteria();

  const handleSuggest = () => {
    if (!description.trim() || suggestMutation.isPending) return;
    suggestMutation.mutate({
      domain: selectedDomain,
      description: description.trim(),
    });
  };

  const handleSelect = (conceptId: number, conceptName: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
    onSelect(conceptId, conceptName);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={cn(
            "w-full max-w-lg rounded-xl border border-[#232328]",
            "bg-[#0E0E11] shadow-2xl shadow-black/50",
            "animate-in fade-in zoom-in-95 duration-200",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#232328]">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[#2DD4BF]" />
              <h3 className="text-sm font-semibold text-[#F0EDE8]">
                Concept Suggestions
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1C1C20] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Domain selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8A857D]">
                Domain
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DOMAINS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setSelectedDomain(d.value)}
                    className={cn(
                      "inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      selectedDomain === d.value
                        ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30"
                        : "bg-[#151518] text-[#8A857D] border border-[#232328] hover:text-[#C5C0B8]",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8A857D]">
                Description
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
                  />
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSuggest();
                      }
                    }}
                    placeholder="e.g., blood pressure medications"
                    className={cn(
                      "w-full rounded-lg border border-[#232328] bg-[#151518]",
                      "pl-9 pr-3 py-2 text-sm text-[#F0EDE8]",
                      "placeholder:text-[#5A5650]",
                      "focus:outline-none focus:border-[#2DD4BF]/40",
                      "transition-colors",
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={!description.trim() || suggestMutation.isPending}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                    "bg-[#2DD4BF] text-[#0E0E11] hover:bg-[#26B8A5]",
                    "transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {suggestMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  Suggest
                </button>
              </div>
            </div>

            {/* Results */}
            {suggestMutation.data && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[#8A857D]">
                  Results ({suggestMutation.data.suggestions.length})
                </p>
                <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
                  {suggestMutation.data.suggestions.map((suggestion) => {
                    const isSelected = selectedIds.has(suggestion.concept_id);
                    return (
                      <div
                        key={suggestion.concept_id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                          isSelected
                            ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/5"
                            : "border-[#232328] bg-[#151518] hover:border-[#2DD4BF]/20",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F0EDE8] truncate">
                            {suggestion.concept_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={cn(
                                "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                                DOMAIN_COLORS[
                                  suggestion.domain.toLowerCase()
                                ] ?? "bg-[#232328] text-[#8A857D]",
                              )}
                            >
                              {suggestion.domain}
                            </span>
                            <span className="text-[10px] text-[#5A5650]">
                              {suggestion.vocabulary_id}
                            </span>
                            <span className="text-[10px] text-[#5A5650]">
                              ID: {suggestion.concept_id}
                            </span>
                          </div>
                        </div>

                        {/* Score bar */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-12 h-1.5 rounded-full bg-[#232328] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#2DD4BF]"
                              style={{
                                width: `${Math.round(suggestion.score * 100)}%`,
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleSelect(
                                suggestion.concept_id,
                                suggestion.concept_name,
                              )
                            }
                            className={cn(
                              "inline-flex items-center justify-center w-7 h-7 rounded-md text-sm transition-colors",
                              isSelected
                                ? "bg-[#2DD4BF] text-[#0E0E11]"
                                : "border border-[#232328] text-[#8A857D] hover:text-[#2DD4BF] hover:border-[#2DD4BF]/30",
                            )}
                          >
                            {isSelected ? (
                              <Check size={14} />
                            ) : (
                              <span className="text-xs">+</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty / error */}
            {suggestMutation.isError && (
              <p className="text-xs text-[#E85A6B] text-center py-2">
                {suggestMutation.error?.message ??
                  "Failed to get suggestions. Please try again."}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#232328]">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-lg px-3 py-2 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
