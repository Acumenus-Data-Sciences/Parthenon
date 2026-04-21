import { useState } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DomainCriteriaSelector,
  getDomainInfo,
} from "./DomainCriteriaSelector";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import type {
  DomainCriterionType,
  DomainCriterion,
} from "../types/cohortExpression";
import { useTranslation } from "react-i18next";

export function PrimaryCriteriaPanel() {
  const { t } = useTranslation("app");
  const {
    expression,
    addPrimaryCriterion,
    removePrimaryCriterion,
    setObservationWindow,
  } = useCohortExpressionStore();

  const [showAdd, setShowAdd] = useState(false);
  const { CriteriaList = [], ObservationWindow = { PriorDays: 0, PostDays: 0 } } = expression.PrimaryCriteria ?? {};

  const handleAdd = (
    domain: DomainCriterionType,
    criterion: DomainCriterion,
  ) => {
    addPrimaryCriterion(domain, criterion);
    setShowAdd(false);
  };

  const inputClass = cn(
    "w-20 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm text-center",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40",
    "font-['IBM_Plex_Mono',monospace] tabular-nums",
  );

  return (
    <div className="space-y-4">
      {/* Info text */}
      <p className="text-xs text-text-ghost">
        {t("cohortDefinitions.auto.defineTheInitialQualifyingEventsEntryEventsFor_5ed24f")}
      </p>

      {/* Criteria list */}
      {CriteriaList.length > 0 ? (
        <div className="space-y-2">
          {CriteriaList.map((criterion, i) => {
            const entries = Object.entries(criterion) as [
              DomainCriterionType,
              DomainCriterion,
            ][];
            const [domain, crit] = entries[0] ?? [null, null];
            const domainInfo = domain ? getDomainInfo(domain) : null;

            return (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-text-ghost">
                    #{i + 1}
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
                  {crit && (
                    <span className="text-xs text-text-muted">
                      {t("cohortDefinitions.auto.conceptSet_7e97e2")}{crit.CodesetId}
                      {crit.First && (
                        <span className="ml-2 text-accent">
                          {t("cohortDefinitions.auto.firstOccurrence_d8d028")}
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removePrimaryCriterion(i)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-critical hover:bg-critical/10 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-8">
          <AlertCircle size={20} className="text-text-ghost mb-2" />
          <p className="text-sm text-text-muted">{t("cohortDefinitions.auto.noPrimaryCriteriaDefined_155391")}</p>
          <p className="mt-1 text-xs text-text-ghost">
            {t("cohortDefinitions.auto.addAtLeastOneEntryEventToDefine_80f619")}
          </p>
        </div>
      )}

      {/* Add button / selector */}
      {showAdd ? (
        <DomainCriteriaSelector
          onAdd={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
        >
          <Plus size={14} />
          {t("cohortDefinitions.auto.addPrimaryCriterion_a69aa7")}
        </button>
      )}

      {/* Observation window */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t("cohortDefinitions.auto.observationWindow_3e7979")}
        </h5>
        <p className="text-xs text-text-ghost">
          {t("cohortDefinitions.auto.requireAMinimumAmountOfContinuousObservationBefore_844d62")}
        </p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.atLeast_0198c3")}</label>
          <input
            type="number"
            min={0}
            value={ObservationWindow.PriorDays}
            onChange={(e) =>
              setObservationWindow(
                Math.max(0, Number(e.target.value)),
                ObservationWindow.PostDays,
              )
            }
            className={inputClass}
          />
          <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.daysBeforeAnd_6844ae")}</label>
          <input
            type="number"
            min={0}
            value={ObservationWindow.PostDays}
            onChange={(e) =>
              setObservationWindow(
                ObservationWindow.PriorDays,
                Math.max(0, Number(e.target.value)),
              )
            }
            className={inputClass}
          />
          <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.daysAfter_d682ef")}</label>
        </div>
      </div>
    </div>
  );
}
