import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { ConceptSetList } from "../components/ConceptSetList";
import { useCreateConceptSet } from "../hooks/useConceptSets";

export default function ConceptSetsPage() {
  const navigate = useNavigate();
  const createMutation = useCreateConceptSet();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = () => {
    setIsCreating(true);
    createMutation.mutate(
      { name: "Untitled Concept Set" },
      {
        onSuccess: (cs) => {
          navigate(`/concept-sets/${cs.id}`);
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
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Concept Sets</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Define and manage reusable concept sets for cohort definitions and
            analyses
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
          New Concept Set
        </button>
      </div>

      {/* List */}
      <ConceptSetList />
    </div>
  );
}
