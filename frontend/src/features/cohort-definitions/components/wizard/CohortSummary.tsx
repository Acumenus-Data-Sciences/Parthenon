import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { describeWindow } from "../../utils/temporalPresets";

const OCCURRENCE_LABELS: Record<number, string> = {
  0: "exactly",
  1: "at most",
  2: "at least",
};

const DOMAIN_LABELS: Record<string, string> = {
  ConditionOccurrence: "condition",
  DrugExposure: "drug exposure",
  ProcedureOccurrence: "procedure",
  Measurement: "measurement",
  Observation: "observation",
  VisitOccurrence: "visit",
  Death: "death",
};

export function CohortSummary() {
  const s = useCohortWizardStore();

  const entryNames = s.entryConcepts.map((e) => e.concept.concept_name);
  const hasDescendants = s.entryConcepts.some((e) => e.includeDescendants);

  return (
    <div className="rounded-lg bg-surface-overlay p-4 text-[13px] leading-[1.8] text-text-secondary">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-text-ghost">
        Your cohort definition reads as:
      </div>

      {/* Entry events */}
      <div>
        Patients with{" "}
        <strong className="text-accent">
          {entryNames.length > 0 ? entryNames.join(", ") : "(no entry events)"}
        </strong>
        {hasDescendants && <span className="text-text-muted"> (or any sub-type)</span>}
        {", "}
        <span className="text-text-ghost">
          using {s.qualifiedLimit.toLowerCase()} qualifying event
          {s.qualifiedLimit === "All" ? "s" : ""}
        </span>
        {","}
      </div>

      {/* Inclusion rules */}
      {s.inclusionRules.map((rule, i) => {
        const conceptName = rule.concepts[0]?.concept.concept_name ?? "...";
        const isExclusion = rule.occurrenceType === 0 && rule.occurrenceCount === 0;
        return (
          <div key={i}>
            {isExclusion ? (
              <>
                and do <strong className="text-critical">NOT</strong> have{" "}
                <strong className="text-accent">{conceptName}</strong>{" "}
                {describeWindow(rule.temporalWindow)}
              </>
            ) : (
              <>
                who have{" "}
                <strong className="text-accent">
                  {OCCURRENCE_LABELS[rule.occurrenceType]} {rule.occurrenceCount}{" "}
                  {DOMAIN_LABELS[rule.domain] ?? rule.domain} of {conceptName}
                </strong>{" "}
                {describeWindow(rule.temporalWindow)}
              </>
            )}
            {","}
          </div>
        );
      })}

      {/* Demographics */}
      {s.demographics?.Age && (
        <div>
          aged{" "}
          <strong className="text-accent">
            {s.demographics.Age.Value}&ndash;{s.demographics.Age.Extent ?? "\u221E"}
          </strong>
          {","}
        </div>
      )}

      {/* End strategy */}
      <div>
        followed until{" "}
        <strong className="text-accent">
          {s.endStrategy.type === "observation" && "end of continuous observation"}
          {s.endStrategy.type === "fixed" && `${s.endStrategy.fixedDays} days after entry`}
          {s.endStrategy.type === "drug_era" &&
            `drug era ends (${s.endStrategy.drugConcepts?.[0]?.concept.concept_name ?? "..."})`}
        </strong>
        {","}
      </div>

      {/* Censoring */}
      {s.censoringConcepts.length > 0 && (
        <div>
          censored at{" "}
          <strong className="text-accent">
            {s.censoringConcepts.map((c) => c.concept.concept_name).join(", ")}
          </strong>
          .
        </div>
      )}
    </div>
  );
}
