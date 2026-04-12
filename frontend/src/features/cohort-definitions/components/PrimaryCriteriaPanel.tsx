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

export function PrimaryCriteriaPanel() {
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
        Define the initial qualifying events (entry events) for this cohort.
        People must have at least one of these events to enter the cohort.
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
                      Concept Set #{crit.CodesetId}
                      {crit.First && (
                        <span className="ml-2 text-accent">
                          (first occurrence)
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
          <p className="text-sm text-text-muted">No primary criteria defined</p>
          <p className="mt-1 text-xs text-text-ghost">
            Add at least one entry event to define this cohort
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
          Add Primary Criterion
        </button>
      )}

      {/* Observation window */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Observation Window
        </h5>
        <p className="text-xs text-text-ghost">
          Require a minimum amount of continuous observation before and after
          the index date.
        </p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-text-muted">At least</label>
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
          <label className="text-xs text-text-muted">days before and</label>
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
          <label className="text-xs text-text-muted">days after</label>
        </div>
      </div>
    </div>
  );
}
