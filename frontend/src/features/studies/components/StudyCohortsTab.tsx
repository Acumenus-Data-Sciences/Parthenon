import { useState } from "react";
import { Loader2, Plus, Target, Trash2, Edit3, Save, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStudyCohorts,
  useAddStudyCohort,
  useUpdateStudyCohort,
  useRemoveStudyCohort,
} from "../hooks/useStudies";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import type { StudyCohort } from "../types/study";

const COHORT_ROLES = ["target", "comparator", "outcome", "exclusion", "subgroup", "event"] as const;

const ROLE_COLORS: Record<string, string> = {
  target: "#2DD4BF",
  comparator: "#60A5FA",
  outcome: "#E85A6B",
  exclusion: "#F59E0B",
  subgroup: "#34D399",
  event: "#A78BFA",
};

interface StudyCohortsTabProps {
  slug: string;
}

export function StudyCohortsTab({ slug }: StudyCohortsTabProps) {
  const { data: cohorts, isLoading } = useStudyCohorts(slug);
  const { data: cohortsData } = useCohortDefinitions();
  const addMutation = useAddStudyCohort();
  const updateMutation = useUpdateStudyCohort();
  const removeMutation = useRemoveStudyCohort();

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [cohortSearch, setCohortSearch] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState<number | "">("");
  const [selectedRole, setSelectedRole] = useState<string>("target");
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Edit state
  const [editId, setEditId] = useState<number | null>(null);
  const [editPayload, setEditPayload] = useState<Partial<StudyCohort>>({});

  // Filter out cohorts already assigned
  const assignedCohortIds = new Set(cohorts?.map((c) => c.cohort_definition_id) ?? []);
  const allCohortDefs = (cohortsData as { items?: { id: number; name: string }[] })?.items ?? [];
  const availableCohorts = allCohortDefs.filter((c) => !assignedCohortIds.has(c.id));
  const filteredCohorts = cohortSearch
    ? availableCohorts.filter((c) =>
        c.name?.toLowerCase().includes(cohortSearch.toLowerCase()),
      )
    : availableCohorts;

  const handleCreate = () => {
    if (!selectedCohortId || !newLabel.trim()) return;
    addMutation.mutate(
      {
        slug,
        payload: {
          cohort_definition_id: selectedCohortId as number,
          role: selectedRole,
          label: newLabel.trim(),
          description: newDescription || null,
          sort_order: (cohorts?.length ?? 0) + 1,
        },
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setSelectedCohortId("");
          setSelectedRole("target");
          setNewLabel("");
          setNewDescription("");
          setCohortSearch("");
        },
      },
    );
  };

  const startEdit = (c: StudyCohort) => {
    setEditId(c.id);
    setEditPayload({ role: c.role, label: c.label, description: c.description });
  };

  const handleSave = () => {
    if (editId == null) return;
    updateMutation.mutate(
      { slug, cohortId: editId, payload: editPayload },
      { onSuccess: () => setEditId(null) },
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#8A857D]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#C5C0B8]">Cohorts ({cohorts?.length ?? 0})</h3>
        <button type="button" onClick={() => setShowAdd(true)} disabled={showAdd} className="btn btn-primary btn-sm">
          <Plus size={14} /> Assign Cohort
        </button>
      </div>

      {/* Add cohort form */}
      {showAdd && (
        <div className="panel space-y-3">
          <p className="text-xs font-medium text-[#C5C0B8] uppercase tracking-wider">Assign Cohort Definition</p>

          {/* Cohort search + select */}
          <div className="space-y-2">
            <label className="text-[10px] text-[#5A5650] uppercase tracking-wider block">Cohort Definition</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
              <input
                type="text"
                value={cohortSearch}
                onChange={(e) => setCohortSearch(e.target.value)}
                placeholder="Search cohort definitions..."
                className="form-input pl-9 w-full"
                autoFocus
              />
            </div>
            {filteredCohorts.length > 0 ? (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-[#232328] bg-[#0E0E11]">
                {filteredCohorts.map((cd) => (
                  <button
                    key={cd.id}
                    type="button"
                    onClick={() => { setSelectedCohortId(cd.id); setCohortSearch(cd.name); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-[#1C1C20] transition-colors",
                      selectedCohortId === cd.id ? "bg-[#2DD4BF]/10 text-[#2DD4BF]" : "text-[#F0EDE8]",
                    )}
                  >
                    {cd.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#5A5650] py-2">
                {availableCohorts.length === 0 ? "All cohort definitions are already assigned" : "No matching cohorts"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">Role</label>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="form-input form-select w-full">
                {COHORT_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">Label *</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., T2DM target population"
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional"
                className="form-input w-full"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowAdd(false); setCohortSearch(""); setSelectedCohortId(""); }} className="btn btn-ghost btn-sm">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={!selectedCohortId || !newLabel.trim() || addMutation.isPending} className="btn btn-primary btn-sm">
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Assign
            </button>
          </div>
        </div>
      )}

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
            const isEditing = editId === c.id;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-[#232328] bg-[#151518] px-4 py-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isEditing ? (
                    <select
                      value={editPayload.role ?? ""}
                      onChange={(e) => setEditPayload({ ...editPayload, role: e.target.value })}
                      className="form-input form-select py-1 text-xs w-28"
                    >
                      {COHORT_ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider shrink-0"
                      style={{ color, backgroundColor: `${color}15` }}
                    >
                      {c.role}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#F0EDE8] font-medium truncate">
                      {c.cohort_definition?.name ?? `Cohort #${c.cohort_definition_id}`}
                    </p>
                    {isEditing ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={editPayload.label ?? ""}
                          onChange={(e) => setEditPayload({ ...editPayload, label: e.target.value })}
                          placeholder="Label"
                          className="form-input py-0.5 text-xs flex-1"
                        />
                        <input
                          type="text"
                          value={editPayload.description ?? ""}
                          onChange={(e) => setEditPayload({ ...editPayload, description: e.target.value })}
                          placeholder="Description"
                          className="form-input py-0.5 text-xs flex-1"
                        />
                      </div>
                    ) : (
                      <>
                        {c.label && <p className="text-xs text-[#5A5650]">{c.label}</p>}
                        {c.description && <p className="text-xs text-[#8A857D] mt-0.5">{c.description}</p>}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {isEditing ? (
                    <>
                      <button type="button" onClick={handleSave} className="p-1 text-[#2DD4BF]"><Save size={14} /></button>
                      <button type="button" onClick={() => setEditId(null)} className="p-1 text-[#5A5650] hover:text-[#C5C0B8]"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => startEdit(c)} className="p-1 text-[#5A5650] hover:text-[#C5C0B8]"><Edit3 size={14} /></button>
                      <button
                        type="button"
                        onClick={() => { if (window.confirm("Remove this cohort assignment?")) removeMutation.mutate({ slug, cohortId: c.id }); }}
                        className="p-1 text-[#5A5650] hover:text-[#E85A6B]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
