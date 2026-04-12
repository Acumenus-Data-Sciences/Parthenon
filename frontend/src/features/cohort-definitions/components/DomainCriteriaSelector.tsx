import { useState } from "react";
import {
  Activity,
  Pill,
  Stethoscope,
  BarChart3,
  Eye,
  Building2,
  Skull,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConceptSetPicker } from "./ConceptSetPicker";
import type {
  DomainCriterionType,
  DomainCriterion,
} from "../types/cohortExpression";

const DOMAIN_OPTIONS: {
  value: DomainCriterionType;
  label: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    value: "ConditionOccurrence",
    label: "Condition",
    icon: Activity,
    color: "var(--critical)",
  },
  {
    value: "DrugExposure",
    label: "Drug",
    icon: Pill,
    color: "var(--info)",
  },
  {
    value: "ProcedureOccurrence",
    label: "Procedure",
    icon: Stethoscope,
    color: "var(--accent)",
  },
  {
    value: "Measurement",
    label: "Measurement",
    icon: BarChart3,
    color: "var(--success)",
  },
  {
    value: "Observation",
    label: "Observation",
    icon: Eye,
    color: "var(--domain-observation)",
  },
  {
    value: "VisitOccurrence",
    label: "Visit",
    icon: Building2,
    color: "var(--domain-device)",
  },
  {
    value: "Death",
    label: "Death",
    icon: Skull,
    color: "var(--text-muted)",
  },
];

interface DomainCriteriaSelectorProps {
  onAdd: (domain: DomainCriterionType, criterion: DomainCriterion) => void;
  onCancel?: () => void;
}

export function DomainCriteriaSelector({
  onAdd,
  onCancel,
}: DomainCriteriaSelectorProps) {
  const [selectedDomain, setSelectedDomain] =
    useState<DomainCriterionType | null>(null);
  const [codesetId, setCodesetId] = useState<number | null>(null);
  const [firstOnly, setFirstOnly] = useState(false);

  const domainInfo = DOMAIN_OPTIONS.find((d) => d.value === selectedDomain);

  const handleAdd = () => {
    if (!selectedDomain || codesetId === null) return;
    const criterion: DomainCriterion = {
      CodesetId: codesetId,
      First: firstOnly || undefined,
    };
    onAdd(selectedDomain, criterion);
    setSelectedDomain(null);
    setCodesetId(null);
    setFirstOnly(false);
  };

  return (
    <div className="rounded-lg border border-border-default bg-surface-overlay p-4 space-y-4">
      <h4 className="text-sm font-semibold text-text-primary">
        Add Criterion
      </h4>

      {/* Domain selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Domain
        </label>
        <div className="grid grid-cols-4 gap-2">
          {DOMAIN_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedDomain === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedDomain(opt.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  isSelected
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary hover:bg-surface-overlay",
                )}
              >
                <Icon size={14} style={{ color: opt.color }} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Concept set picker + options (shown when domain selected) */}
      {selectedDomain && (
        <>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Concept Set
            </label>
            <ConceptSetPicker value={codesetId} onChange={setCodesetId} />
          </div>

          {/* First occurrence only */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={firstOnly}
              onChange={(e) => setFirstOnly(e.target.checked)}
              className="rounded border-border-default bg-surface-base text-success focus:ring-success/40"
            />
            <span className="text-xs text-text-muted">
              First occurrence only
            </span>
          </label>

          {/* Domain info badge */}
          {domainInfo && (
            <div className="flex items-center gap-2">
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
              {codesetId !== null && (
                <span className="text-xs text-text-ghost">
                  Codeset #{codesetId}
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={handleAdd}
              disabled={codesetId === null}
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50"
            >
              Add Criterion
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Utility to get the display info for a domain type
export function getDomainInfo(domain: DomainCriterionType) {
  return DOMAIN_OPTIONS.find((d) => d.value === domain);
}
