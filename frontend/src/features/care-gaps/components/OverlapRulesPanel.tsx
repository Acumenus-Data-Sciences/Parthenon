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
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
        <AlertCircle size={24} className="text-critical mb-3" />
        <p className="text-sm text-critical">
          Failed to load overlap rules.
        </p>
      </div>
    );
  }

  if (!rules || rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
        <Shuffle size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">
          No overlap rules configured.
        </p>
        <p className="mt-1 text-xs text-text-ghost">
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
            className="rounded-lg border border-border-default bg-surface-raised overflow-hidden"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedId(isExpanded ? null : rule.id)
              }
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-overlay transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-text-muted shrink-0" />
              ) : (
                <ChevronRight size={14} className="text-text-muted shrink-0" />
              )}

              {/* Rule code */}
              <span className="text-xs font-medium font-['IBM_Plex_Mono',monospace] text-domain-observation">
                {rule.rule_code}
              </span>

              {/* Shared domain */}
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-info/10 text-info">
                {rule.shared_domain}
              </span>

              {/* Applicable bundles */}
              <div className="flex-1 flex items-center gap-1 overflow-hidden">
                {rule.applicable_bundle_codes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success shrink-0"
                  >
                    {code}
                  </span>
                ))}
              </div>

              {/* Canonical measure */}
              <span className="text-xs text-accent shrink-0">
                {rule.canonical_measure_code}
              </span>
            </button>

            {/* Expanded description */}
            {isExpanded && rule.description && (
              <div className={cn("px-4 pb-3 pt-0 border-t border-border-default")}>
                <p className="text-xs text-text-muted leading-relaxed mt-3">
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
