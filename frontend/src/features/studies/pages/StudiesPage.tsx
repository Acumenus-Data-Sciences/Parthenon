import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import { StudyList } from "../components/StudyList";
import { useStudies, useCreateStudy } from "../hooks/useStudies";

export default function StudiesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading, error } = useStudies(page);
  const createMutation = useCreateStudy();

  const handleCreate = () => {
    setIsCreating(true);
    createMutation.mutate(
      {
        name: "Untitled Study",
        study_type: "Mixed",
      },
      {
        onSuccess: (study) => {
          navigate(`/studies/${study.id}`);
        },
        onSettled: () => setIsCreating(false),
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Studies</h1>
          <p className="page-subtitle">
            Orchestrate and manage multi-analysis research studies
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          className="btn btn-primary"
        >
          {isCreating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          New Study
        </button>
      </div>

      {/* Study List */}
      <StudyList
        studies={data?.data ?? []}
        onSelect={(id) => navigate(`/studies/${id}`)}
        isLoading={isLoading}
        error={error}
        page={page}
        totalPages={data?.meta?.last_page ?? 1}
        total={data?.meta?.total ?? 0}
        perPage={data?.meta?.per_page ?? 15}
        onPageChange={setPage}
      />
    </div>
  );
}
