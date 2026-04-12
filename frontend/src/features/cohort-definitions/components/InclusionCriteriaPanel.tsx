import { useState } from "react";
import { Plus, AlertCircle } from "lucide-react";
import { CriteriaGroupEditor } from "./CriteriaGroupEditor";
import { DomainCriteriaSelector } from "./DomainCriteriaSelector";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import type {
  DomainCriterionType,
  DomainCriterion,
  CriteriaGroup,
} from "../types/cohortExpression";

export function InclusionCriteriaPanel() {
  const { expression, setAdditionalCriteria, addInclusionRule } =
    useCohortExpressionStore();
  const [showAdd, setShowAdd] = useState(false);

  const additionalCriteria: CriteriaGroup = expression.AdditionalCriteria ?? {
    Type: "ALL",
    CriteriaList: [],
    Groups: [],
  };

  const handleGroupChange = (group: CriteriaGroup) => {
    setAdditionalCriteria(group);
  };

  const handleAddRule = (
    domain: DomainCriterionType,
    criterion: DomainCriterion,
  ) => {
    addInclusionRule({
      Criteria: { [domain]: criterion },
      Occurrence: { Type: 2, Count: 1 },
    });
    setShowAdd(false);
  };

  const hasAnyCriteria =
    additionalCriteria.CriteriaList.length > 0 ||
    additionalCriteria.Groups.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#5A5650]">
        Define additional inclusion criteria that must be satisfied after the
        initial qualifying events. These further restrict which people qualify
        for the cohort.
      </p>

      {hasAnyCriteria ? (
        <CriteriaGroupEditor
          group={additionalCriteria}
          onChange={handleGroupChange}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-8">
          <AlertCircle size={20} className="text-[#323238] mb-2" />
          <p className="text-sm text-[#8A857D]">
            No additional inclusion criteria
          </p>
          <p className="mt-1 text-xs text-[#5A5650]">
            All people matching primary criteria will be included
          </p>
        </div>
      )}

      {/* Add rule */}
      {showAdd ? (
        <DomainCriteriaSelector
          onAdd={handleAddRule}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2.5 text-sm text-[#C5C0B8] hover:bg-[#1A1A1E] hover:text-[#F0EDE8] transition-colors"
        >
          <Plus size={14} />
          Add Inclusion Rule
        </button>
      )}
    </div>
  );
}
