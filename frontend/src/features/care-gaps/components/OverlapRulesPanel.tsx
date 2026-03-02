import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, AlertCircle, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOverlapRules } from "../hooks/useCareGaps";
import type { BundleOverlapRule } from "../types/careGap";

export function OverlapRulesPanel() {
  const { data: rules, isLoading, error } = useOverlapRules();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-12">
        <AlertCircle size={24} className="text-[#E85A6B] mb-3" />
        <p className="text-sm text-[#E85A6B]">
          Failed to load overlap rules.
        </p>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-12">
        <Shuffle size={24} className="text-[#323238] mb-3" />
        <p className="text-sm text-[#8A857D]">
          No overlap rules configured.
        </p>
        <p className="mt-1 text-xs text-[#5A5650]">
          Overlap rules prevent double-counting measures across bundles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rules.map((rule: BundleOverlapRule) => {
        const isExpanded = expandedId === rule.id;
        return (
          <div
            key={rule.id}
            className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedId(isExpanded ? null : rule.id)
              }
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1A1A1E] transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-[#8A857D] shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-[#8A857D] shrink-0" />
              )}

              {/* Rule code */}
              <span className="text-xs font-medium font-['IBM_Plex_Mono',monospace] text-[#8B5CF6]">
                {rule.rule_code}
              </span>

              {/* Shared domain */}
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#818CF8]/10 text-[#818CF8]">
                {rule.shared_domain}
              </span>

              {/* Applicable bundles */}
              <div className="flex-1 flex items-center gap-1 overflow-hidden">
                {rule.applicable_bundle_codes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/10 text-[#2DD4BF] shrink-0"
                  >
                    {code}
                  </span>
                ))}
              </div>

              {/* Canonical measure */}
              <span className="text-xs text-[#C9A227] shrink-0">
                {rule.canonical_measure_code}
              </span>
            </button>

            {/* Expanded description */}
            {isExpanded && rule.description && (
              <div className={cn("px-4 pb-3 pt-0 border-t border-[#232328]")}>
                <p className="text-xs text-[#8A857D] leading-relaxed mt-3">
                  {rule.description}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
