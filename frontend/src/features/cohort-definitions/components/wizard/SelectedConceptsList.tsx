import { X } from "lucide-react";
import type { WizardEntryConcept } from "../../utils/buildExpression";
import { useTranslation } from "react-i18next";

interface SelectedConceptsListProps {
  concepts: WizardEntryConcept[];
  onRemove: (conceptId: number) => void;
  onUpdateOptions?: (
    conceptId: number,
    options: Partial<
      Pick<WizardEntryConcept, "includeDescendants" | "includeMapped" | "firstOccurrenceOnly">
    >,
  ) => void;
  showFirstOccurrence?: boolean;
}

export function SelectedConceptsList({
  concepts,
  onRemove,
  onUpdateOptions,
  showFirstOccurrence = false,
}: SelectedConceptsListProps) {
  const { t } = useTranslation("app");
  if (concepts.length === 0) return null;

  return (
    <div className="border-t border-border-subtle pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-text-ghost">
        {t("cohortDefinitions.auto.selected_666452")}{concepts.length})
      </div>
      <div className="flex flex-col gap-1.5">
        {concepts.map((entry) => (
          <div
            key={entry.concept.concept_id}
            className="flex items-center rounded-md border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <span className="mr-2 font-mono text-[11px] text-accent">
                {entry.concept.concept_id}
              </span>
              <span className="text-[13px] text-text-secondary">
                {entry.concept.concept_name}
              </span>
              <span className="ml-2 rounded bg-[rgba(155,27,48,0.2)] px-1.5 py-0.5 text-[10px] text-critical">
                {entry.concept.domain_id}
              </span>
              <span className="ml-1 rounded bg-[rgba(201,162,39,0.2)] px-1.5 py-0.5 text-[10px] text-accent">
                {entry.concept.vocabulary_id}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {onUpdateOptions && (
                <>
                  <label className="flex items-center gap-1 text-[11px] text-text-muted">
                    <input
                      type="checkbox"
                      checked={entry.includeDescendants}
                      onChange={(e) =>
                        onUpdateOptions(entry.concept.concept_id, {
                          includeDescendants: e.target.checked,
                        })
                      }
                      className="accent-success"
                    />
                    {t("cohortDefinitions.auto.descendants_290452")}
                  </label>
                  {showFirstOccurrence && (
                    <label className="flex items-center gap-1 text-[11px] text-text-muted">
                      <input
                        type="checkbox"
                        checked={entry.firstOccurrenceOnly}
                        onChange={(e) =>
                          onUpdateOptions(entry.concept.concept_id, {
                            firstOccurrenceOnly: e.target.checked,
                          })
                        }
                        className="accent-success"
                      />
                      {t("cohortDefinitions.auto.firstOnly_64843c")}
                    </label>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => onRemove(entry.concept.concept_id)}
                className="text-text-disabled hover:text-critical"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
