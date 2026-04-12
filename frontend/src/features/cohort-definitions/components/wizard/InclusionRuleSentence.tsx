import { Trash2 } from "lucide-react";
import type { Concept } from "@/features/vocabulary/types/vocabulary";
import type { DomainCriterionType } from "../../types/cohortExpression";
import type { WizardInclusionRule } from "../../utils/buildExpression";
import { describeWindow } from "../../utils/temporalPresets";
import { TemporalPresetPicker } from "./TemporalPresetPicker";
import { WizardConceptPicker } from "./WizardConceptPicker";

const DOMAIN_LABELS: Record<DomainCriterionType, string> = {
  ConditionOccurrence: "condition",
  DrugExposure: "drug exposure",
  ProcedureOccurrence: "procedure",
  Measurement: "measurement",
  Observation: "observation",
  VisitOccurrence: "visit",
  Death: "death",
};

const OCCURRENCE_LABELS: Record<number, string> = {
  0: "exactly",
  1: "at most",
  2: "at least",
};

interface InclusionRuleSentenceProps {
  rule: WizardInclusionRule;
  index: number;
  onUpdate: (index: number, updates: Partial<WizardInclusionRule>) => void;
  onAddConcept: (ruleIndex: number, concept: Concept, domain: DomainCriterionType) => void;
  onRemoveConcept: (ruleIndex: number, conceptId: number) => void;
  onRemove: (index: number) => void;
}

export function InclusionRuleSentence({
  rule,
  index,
  onUpdate,
  onAddConcept,
  onRemoveConcept,
  onRemove,
}: InclusionRuleSentenceProps) {
  const isExclusion = rule.occurrenceType === 0 && rule.occurrenceCount === 0;
  const primaryConceptName = rule.concepts[0]?.concept.concept_name ?? "...";

  return (
    <div className="rounded-lg border border-border-default bg-surface-base p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-text-ghost">
            Rule {index + 1}
          </span>
          {isExclusion && (
            <span className="rounded bg-[rgba(155,27,48,0.2)] px-1.5 py-0.5 text-[10px] text-critical">
              exclusion
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-text-disabled hover:text-critical"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Sentence builder */}
      <div className="flex flex-wrap items-center gap-1.5 text-[14px] leading-[2.2]">
        <span className="text-text-secondary">Require</span>
        <select
          value={rule.occurrenceType}
          onChange={(e) => onUpdate(index, { occurrenceType: parseInt(e.target.value) as 0 | 1 | 2 })}
          className="rounded border border-border-default bg-surface-overlay px-2.5 py-1 text-[13px] text-success outline-none"
        >
          <option value={2}>at least</option>
          <option value={1}>at most</option>
          <option value={0}>exactly</option>
        </select>
        <input
          type="number"
          min={0}
          value={rule.occurrenceCount}
          onChange={(e) => onUpdate(index, { occurrenceCount: Math.max(0, parseInt(e.target.value) || 0) })}
          className="w-[40px] rounded border border-border-default bg-surface-overlay px-2 py-1 text-center text-[13px] text-accent outline-none focus:border-accent"
        />
        <select
          value={rule.domain}
          onChange={(e) => onUpdate(index, { domain: e.target.value as DomainCriterionType })}
          className="rounded border border-border-default bg-surface-overlay px-2.5 py-1 text-[13px] text-success outline-none"
        >
          {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-text-secondary">of</span>
        <span className="rounded border border-[rgba(201,162,39,0.3)] bg-[rgba(201,162,39,0.15)] px-2.5 py-1 text-[13px] text-accent">
          {primaryConceptName}
        </span>
      </div>

      {/* Concept picker */}
      <div className="mt-3">
        <WizardConceptPicker
          concepts={rule.concepts}
          onAdd={(concept, domain) => onAddConcept(index, concept, domain)}
          onRemove={(conceptId) => onRemoveConcept(index, conceptId)}
        />
      </div>

      {/* Temporal */}
      <div className="mt-3">
        <div className="mb-2 text-[12px] text-text-muted">Occurring:</div>
        <TemporalPresetPicker
          value={rule.temporalWindow}
          onChange={(window) => onUpdate(index, { temporalWindow: window })}
        />
      </div>

      {/* Restrict to same visit */}
      <div className="mt-3">
        <label className="flex items-center gap-2 text-[12px] text-text-muted">
          <input
            type="checkbox"
            checked={rule.restrictVisit}
            onChange={(e) => onUpdate(index, { restrictVisit: e.target.checked })}
            className="accent-success"
          />
          Restrict to same visit
        </label>
      </div>

      {/* Live preview */}
      <div className="mt-3 rounded-md border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-3 py-2">
        <span className="text-[11px] text-text-ghost">READS AS: </span>
        <span className="text-[13px] text-text-secondary">
          &ldquo;Require {OCCURRENCE_LABELS[rule.occurrenceType]} {rule.occurrenceCount}{" "}
          {DOMAIN_LABELS[rule.domain]} of{" "}
          <strong className="text-accent">{primaryConceptName}</strong>{" "}
          {describeWindow(rule.temporalWindow)}&rdquo;
        </span>
      </div>
    </div>
  );
}
