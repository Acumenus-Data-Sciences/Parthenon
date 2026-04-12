import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TemporalWindowEditor } from "./TemporalWindowEditor";
import { getDomainInfo } from "./DomainCriteriaSelector";
import type {
  WindowedCriteria,
  DomainCriterionType,
  TemporalWindow,
  OccurrenceCount,
} from "../types/cohortExpression";

interface InclusionRuleEditorProps {
  rule: WindowedCriteria;
  index: number;
  onChange: (rule: WindowedCriteria) => void;
  onRemove: () => void;
}

const OCCURRENCE_TYPES = [
  { value: 0, label: "exactly" },
  { value: 1, label: "at most" },
  { value: 2, label: "at least" },
] as const;

export function InclusionRuleEditor({
  rule,
  index,
  onChange,
  onRemove,
}: InclusionRuleEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract the domain info from the criteria
  const domainEntries = Object.entries(rule.Criteria) as [
    DomainCriterionType,
    unknown,
  ][];
  const primaryDomain = domainEntries[0]?.[0];
  const domainInfo = primaryDomain ? getDomainInfo(primaryDomain) : null;

  const occurrence: OccurrenceCount = rule.Occurrence ?? {
    Type: 2,
    Count: 1,
  };

  const handleOccurrenceChange = (occ: Partial<OccurrenceCount>) => {
    onChange({
      ...rule,
      Occurrence: { ...occurrence, ...occ },
    });
  };

  const handleStartWindowChange = (window: TemporalWindow) => {
    onChange({ ...rule, StartWindow: window });
  };

  const handleEndWindowChange = (window: TemporalWindow) => {
    onChange({ ...rule, EndWindow: window });
  };

  const inputClass = cn(
    "w-16 rounded-lg border border-border-default bg-surface-base px-2 py-1 text-sm text-center",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40",
    "font-['IBM_Plex_Mono',monospace] tabular-nums",
  );

  const selectClass = cn(
    "appearance-none rounded-lg border border-border-default bg-surface-base px-2 py-1 text-sm",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40",
    "cursor-pointer",
  );

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-overlay transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown size={14} className="text-text-muted" />
          ) : (
            <ChevronRight size={14} className="text-text-muted" />
          )}
          <span className="text-xs font-medium text-text-ghost">
            #{index + 1}
          </span>
          {domainInfo && (
            <span
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${domainInfo.color}15`,
                color: domainInfo.color,
              }}
            >
              <domainInfo.icon size={10} />
              {domainInfo.label}
            </span>
          )}
          <span className="text-sm text-text-secondary">
            {OCCURRENCE_TYPES.find((t) => t.value === occurrence.Type)?.label}{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-success">
              {occurrence.Count}
            </span>{" "}
            occurrence{occurrence.Count !== 1 ? "s" : ""}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-critical hover:bg-critical/10 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border-default px-4 py-4 space-y-4">
          {/* Occurrence */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Occurrence
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Having</span>
              <select
                value={occurrence.Type}
                onChange={(e) =>
                  handleOccurrenceChange({
                    Type: Number(e.target.value) as 0 | 1 | 2,
                  })
                }
                className={selectClass}
              >
                {OCCURRENCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                value={occurrence.Count}
                onChange={(e) =>
                  handleOccurrenceChange({
                    Count: Math.max(0, Number(e.target.value)),
                  })
                }
                className={inputClass}
              />
              <span className="text-xs text-text-muted">
                occurrence{occurrence.Count !== 1 ? "s" : ""} of
              </span>
              {domainInfo && (
                <span
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `${domainInfo.color}15`,
                    color: domainInfo.color,
                  }}
                >
                  {domainInfo.label}
                </span>
              )}
            </div>
          </div>

          {/* Start window */}
          <TemporalWindowEditor
            label="Start Window"
            value={
              rule.StartWindow ?? {
                Start: { Days: 0, Coeff: -1 },
                End: { Days: 0, Coeff: 1 },
              }
            }
            onChange={handleStartWindowChange}
          />

          {/* End window (optional) */}
          {rule.EndWindow && (
            <TemporalWindowEditor
              label="End Window"
              value={rule.EndWindow}
              onChange={handleEndWindowChange}
            />
          )}

          {/* Restrict to visit */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rule.RestrictVisit ?? false}
              onChange={(e) =>
                onChange({ ...rule, RestrictVisit: e.target.checked })
              }
              className="rounded border-border-default bg-surface-base text-success focus:ring-success/40"
            />
            <span className="text-xs text-text-muted">
              Restrict to same visit as index event
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
