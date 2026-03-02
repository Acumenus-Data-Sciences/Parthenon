import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { CohortDefinitionList } from "../components/CohortDefinitionList";
import { useCreateCohortDefinition } from "../hooks/useCohortDefinitions";

const defaultExpression = {
  ConceptSets: [],
  PrimaryCriteria: {
    CriteriaList: [],
    ObservationWindow: { PriorDays: 0, PostDays: 0 },
  },
  QualifiedLimit: { Type: "First" as const },
  ExpressionLimit: { Type: "First" as const },
  CollapseSettings: { CollapseType: "ERA" as const, EraPad: 0 },
};

export default function CohortDefinitionsPage() {
  const navigate = useNavigate();
  const createMutation = useCreateCohortDefinition();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    setIsCreating(true);
    createMutation.mutate(
      {
        name: "Untitled Cohort Definition",
        expression_json: defaultExpression,
      },
      {
        onSuccess: (def) => {
          navigate(`/cohort-definitions/${def.id}`);
        },
        onSettled: () => {
          setIsCreating(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Cohort Definitions
          </h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Define and manage cohort definitions for population-level studies
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          New Cohort Definition
        </button>
      </div>

      {/* List */}
      <CohortDefinitionList />
    </div>
  );
}
