import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { describeWindow } from "../../utils/temporalPresets";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("app");
  const s = useCohortWizardStore();

  const entryNames = s.entryConcepts.map((e) => e.concept.concept_name);
  const hasDescendants = s.entryConcepts.some((e) => e.includeDescendants);

  return (
    <div className="rounded-lg bg-surface-overlay p-4 text-[13px] leading-[1.8] text-text-secondary">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-text-ghost">
        {t("cohortDefinitions.auto.yourCohortDefinitionReadsAs_02afaa")}
      </div>

      {/* Entry events */}
      <div>
        {t("cohortDefinitions.auto.patientsWith_8f8bc7")}{" "}
        <strong className="text-accent">
          {entryNames.length > 0 ? entryNames.join(", ") : "(no entry events)"}
        </strong>
        {hasDescendants && <span className="text-text-muted"> {t("cohortDefinitions.auto.orAnySubType_2e6910")}</span>}
        {", "}
        <span className="text-text-ghost">
          using {s.qualifiedLimit.toLowerCase()} {t("cohortDefinitions.auto.qualifyingEvent_3e92ae")}
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
                {t("cohortDefinitions.auto.andDo_c36305")} <strong className="text-critical">NOT</strong> have{" "}
                <strong className="text-accent">{conceptName}</strong>{" "}
                {describeWindow(rule.temporalWindow)}
              </>
            ) : (
              <>
                {t("cohortDefinitions.auto.whoHave_fc8310")}{" "}
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
            {s.demographics.Age.Value}{t("cohortDefinitions.auto.text_47a744")}{s.demographics.Age.Extent ?? "\u221E"}
          </strong>
          {","}
        </div>
      )}

      {/* End strategy */}
      <div>
        {t("cohortDefinitions.auto.followedUntil_a6f473")}{" "}
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
          {t("cohortDefinitions.auto.censoredAt_9ce809")}{" "}
          <strong className="text-accent">
            {s.censoringConcepts.map((c) => c.concept.concept_name).join(", ")}
          </strong>
          .
        </div>
      )}
    </div>
  );
}
