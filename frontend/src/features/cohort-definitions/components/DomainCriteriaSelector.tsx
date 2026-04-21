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
import i18next from "@/i18n/i18n";
import { useTranslation } from "react-i18next";

function tApp(key: string): string {
  return i18next.t(key, { ns: "app" });
}

function getDomainOptions(): {
  value: DomainCriterionType;
  label: string;
  icon: LucideIcon;
  color: string;
}[] {
  return [
    {
      value: "ConditionOccurrence",
      label: tApp("cohortDefinitions.auto.condition_9e2941"),
      icon: Activity,
      color: "var(--critical)",
    },
    {
      value: "DrugExposure",
      label: tApp("cohortDefinitions.auto.drug_5db77f"),
      icon: Pill,
      color: "var(--info)",
    },
    {
      value: "ProcedureOccurrence",
      label: tApp("cohortDefinitions.auto.procedure_8c4271"),
      icon: Stethoscope,
      color: "var(--accent)",
    },
    {
      value: "Measurement",
      label: tApp("cohortDefinitions.auto.measurement_911842"),
      icon: BarChart3,
      color: "var(--success)",
    },
    {
      value: "Observation",
      label: tApp("cohortDefinitions.auto.observation_c680d4"),
      icon: Eye,
      color: "var(--domain-observation)",
    },
    {
      value: "VisitOccurrence",
      label: tApp("cohortDefinitions.auto.visit_5e706a"),
      icon: Building2,
      color: "var(--domain-device)",
    },
    {
      value: "Death",
      label: tApp("cohortDefinitions.auto.death_6097f8"),
      icon: Skull,
      color: "var(--text-muted)",
    },
  ];
}

interface DomainCriteriaSelectorProps {
  onAdd: (domain: DomainCriterionType, criterion: DomainCriterion) => void;
  onCancel?: () => void;
}

export function DomainCriteriaSelector({
  onAdd,
  onCancel,
}: DomainCriteriaSelectorProps) {
  const { t } = useTranslation("app");
  const domainOptions = getDomainOptions();
  const [selectedDomain, setSelectedDomain] =
    useState<DomainCriterionType | null>(null);
  const [codesetId, setCodesetId] = useState<number | null>(null);
  const [firstOnly, setFirstOnly] = useState(false);

  const domainInfo = domainOptions.find((d) => d.value === selectedDomain);

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
        {t("cohortDefinitions.auto.addCriterion_7ec1c2")}
      </h4>

      {/* Domain selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("cohortDefinitions.auto.domain_eae639")}
        </label>
        <div className="grid grid-cols-4 gap-2">
          {domainOptions.map((opt) => {
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
              {t("cohortDefinitions.auto.conceptSet_ca2d17")}
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
              {t("cohortDefinitions.auto.firstOccurrenceOnly_70882a")}
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
                  {t("cohortDefinitions.auto.codeset_3105b8")}{codesetId}
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
              {t("cohortDefinitions.auto.addCriterion_7ec1c2")}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
              >
                {t("cohortDefinitions.auto.cancel_ea4788")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Utility to get the display info for a domain type
// eslint-disable-next-line react-refresh/only-export-components
export function getDomainInfo(domain: DomainCriterionType) {
  return getDomainOptions().find((d) => d.value === domain);
}
