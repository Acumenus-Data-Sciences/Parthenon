import { useState } from "react";
import { Loader2, Plus, Milestone, Trash2, Edit3, Save, X, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStudyMilestones,
  useCreateStudyMilestone,
  useUpdateStudyMilestone,
  useDeleteStudyMilestone,
} from "../hooks/useStudies";
import type { StudyMilestone } from "../types/study";

const STATUS_ICONS: Record<string, { icon: typeof Clock; color: string }> = {
  pending: { icon: Clock, color: "var(--text-muted)" },
  in_progress: { icon: Loader2, color: "var(--warning)" },
  completed: { icon: CheckCircle2, color: "var(--success)" },
  overdue: { icon: AlertTriangle, color: "var(--critical)" },
  cancelled: { icon: X, color: "var(--text-ghost)" },
};

const MILESTONE_TYPES = [
  "protocol", "irb", "data_access", "analysis", "review", "publication", "custom",
];

interface StudyMilestonesTabProps {
  slug: string;
}

export function StudyMilestonesTab({ slug }: StudyMilestonesTabProps) {
  const { data: milestones, isLoading } = useStudyMilestones(slug);
  const createMutation = useCreateStudyMilestone();
  const updateMutation = useUpdateStudyMilestone();
  const deleteMutation = useDeleteStudyMilestone();

  const [editId, setEditId] = useState<number | null>(null);
  const [editPayload, setEditPayload] = useState<Partial<StudyMilestone>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("custom");
  const [newTargetDate, setNewTargetDate] = useState("");

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate(
      {
        slug,
        payload: {
          title: newTitle.trim(),
          milestone_type: newType,
          status: "pending",
          target_date: newTargetDate || null,
          sort_order: (milestones?.length ?? 0) + 1,
        },
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setNewTitle("");
          setNewType("custom");
          setNewTargetDate("");
        },
      },
    );
  };

  const handleSave = () => {
    if (editId == null) return;
    updateMutation.mutate(
      { slug, milestoneId: editId, payload: editPayload },
      { onSuccess: () => setEditId(null) },
    );
  };

  const isOverdue = (m: StudyMilestone) => {
    if (m.status === "completed" || m.status === "cancelled") return false;
    if (!m.target_date) return false;
    return new Date(m.target_date) < new Date();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-muted" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary">Milestones ({milestones?.length ?? 0})</h3>
        <button type="button" onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">
          <Plus size={14} /> Add Milestone
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="panel space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Milestone title..."
              className="form-input col-span-1"
              autoFocus
            />
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className="form-input form-select">
              {MILESTONE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input type="date" value={newTargetDate} onChange={(e) => setNewTargetDate(e.target.value)} className="form-input" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost btn-sm">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending} className="btn btn-primary btn-sm">
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Create
            </button>
          </div>
        </div>
      )}

      {(!milestones || milestones.length === 0) ? (
        <div className="empty-state">
          <Milestone size={24} className="text-text-ghost mb-2" />
          <h3 className="empty-title">No milestones</h3>
          <p className="empty-message">Track study progress with milestones and target dates</p>
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => {
            const overdue = isOverdue(m);
            const effectiveStatus = overdue ? "overdue" : m.status;
            const si = STATUS_ICONS[effectiveStatus] ?? STATUS_ICONS.pending;
            const Icon = si.icon;
            const isEditing = editId === m.id;

            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3",
                  overdue ? "border-critical/30 bg-critical/5" : "border-border-default bg-surface-raised",
                )}
              >
                <Icon size={16} style={{ color: si.color }} className={effectiveStatus === "in_progress" ? "animate-spin" : ""} />

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editPayload.title ?? ""}
                        onChange={(e) => setEditPayload({ ...editPayload, title: e.target.value })}
                        className="form-input py-1 text-sm flex-1"
                      />
                      <select
                        value={editPayload.status ?? ""}
                        onChange={(e) => setEditPayload({ ...editPayload, status: e.target.value })}
                        className="form-input form-select py-1 text-xs w-32"
                      >
                        {Object.keys(STATUS_ICONS).filter((s) => s !== "overdue").map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", m.status === "completed" ? "text-text-ghost line-through" : "text-text-primary")}>
                        {m.title}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] text-text-ghost bg-surface-elevated capitalize">
                        {m.milestone_type.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                  {m.target_date && !isEditing && (
                    <p className={cn("text-xs mt-0.5", overdue ? "text-critical" : "text-text-ghost")}>
                      Target: {new Date(m.target_date).toLocaleDateString()}
                      {m.actual_date && ` | Completed: ${new Date(m.actual_date).toLocaleDateString()}`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <button type="button" onClick={handleSave} className="p-1 text-success"><Save size={14} /></button>
                      <button type="button" onClick={() => setEditId(null)} className="p-1 text-text-ghost hover:text-text-secondary"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditId(m.id); setEditPayload({ title: m.title, status: m.status }); }} className="p-1 text-text-ghost hover:text-text-secondary"><Edit3 size={14} /></button>
                      <button
                        type="button"
                        onClick={() => { if (window.confirm("Delete this milestone?")) deleteMutation.mutate({ slug, milestoneId: m.id }); }}
                        className="p-1 text-text-ghost hover:text-critical"
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
