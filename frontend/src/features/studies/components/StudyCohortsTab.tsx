import { Loader2, Plus, Target, Trash2 } from "lucide-react";
import {
  useStudyCohorts,
  useAddStudyCohort,
  useRemoveStudyCohort,
} from "../hooks/useStudies";

const ROLE_COLORS: Record<string, string> = {
  target: "#2DD4BF",
  comparator: "#60A5FA",
  outcome: "#E85A6B",
  exclusion: "#F59E0B",
  indication: "#A78BFA",
  subgroup: "#34D399",
};

interface StudyCohortsTabProps {
  slug: string;
}

export function StudyCohortsTab({ slug }: StudyCohortsTabProps) {
  const { data: cohorts, isLoading } = useStudyCohorts(slug);
  const addMutation = useAddStudyCohort();
  const removeMutation = useRemoveStudyCohort();

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#8A857D]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#C5C0B8]">Cohorts ({cohorts?.length ?? 0})</h3>
        <button
          type="button"
          onClick={() => addMutation.mutate({ slug, payload: { cohort_definition_id: 1, role: "target", sort_order: (cohorts?.length ?? 0) + 1 } })}
          disabled={addMutation.isPending}
          className="btn btn-primary btn-sm"
        >
          {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Assign Cohort
        </button>
      </div>

      {(!cohorts || cohorts.length === 0) ? (
        <div className="empty-state">
          <Target size={24} className="text-[#323238] mb-2" />
          <h3 className="empty-title">No cohorts assigned</h3>
          <p className="empty-message">Assign cohort definitions and specify their roles in this study</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cohorts.map((c) => {
            const color = ROLE_COLORS[c.role] ?? "#8A857D";
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-[#232328] bg-[#151518] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
                    style={{ color, backgroundColor: `${color}15` }}
                  >
                    {c.role}
                  </span>
                  <div>
                    <p className="text-sm text-[#F0EDE8] font-medium">
                      {c.cohort_definition?.name ?? `Cohort #${c.cohort_definition_id}`}
                    </p>
                    {c.label && <p className="text-xs text-[#5A5650]">{c.label}</p>}
                    {c.description && <p className="text-xs text-[#8A857D] mt-0.5">{c.description}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { if (window.confirm("Remove this cohort assignment?")) removeMutation.mutate({ slug, cohortId: c.id }); }}
                  className="p-1 text-[#5A5650] hover:text-[#E85A6B]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
