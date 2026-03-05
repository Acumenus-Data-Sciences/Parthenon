import { useState } from "react";
import { Loader2, Plus, Users, Trash2, Edit3, Save, X } from "lucide-react";
import {
  useStudyTeam,
  useAddStudyTeamMember,
  useUpdateStudyTeamMember,
  useRemoveStudyTeamMember,
} from "../hooks/useStudies";
import type { StudyTeamMember } from "../types/study";

const ROLE_COLORS: Record<string, string> = {
  principal_investigator: "#2DD4BF",
  co_investigator: "#60A5FA",
  data_scientist: "#A78BFA",
  statistician: "#F59E0B",
  site_lead: "#34D399",
  coordinator: "#FB923C",
  analyst: "#E85A6B",
  viewer: "#8A857D",
};

interface StudyTeamTabProps {
  slug: string;
}

export function StudyTeamTab({ slug }: StudyTeamTabProps) {
  const { data: members, isLoading } = useStudyTeam(slug);
  const addMutation = useAddStudyTeamMember();
  const updateMutation = useUpdateStudyTeamMember();
  const removeMutation = useRemoveStudyTeamMember();

  const [editId, setEditId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState("");

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#8A857D]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#C5C0B8]">Team Members ({members?.length ?? 0})</h3>
        <button
          type="button"
          onClick={() => addMutation.mutate({ slug, payload: { user_id: 1, role: "analyst" } })}
          disabled={addMutation.isPending}
          className="btn btn-primary btn-sm"
        >
          {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add Member
        </button>
      </div>

      {(!members || members.length === 0) ? (
        <div className="empty-state">
          <Users size={24} className="text-[#323238] mb-2" />
          <h3 className="empty-title">No team members</h3>
          <p className="empty-message">Add researchers and collaborators to this study</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isEditing = editId === m.id;
                const color = ROLE_COLORS[m.role] ?? "#8A857D";
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center text-[10px] font-medium text-[#2DD4BF]">
                          {m.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-[#F0EDE8] font-medium">{m.user?.name ?? `User #${m.user_id}`}</span>
                      </div>
                    </td>
                    <td className="text-xs text-[#8A857D]">{m.user?.email ?? "—"}</td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="form-input form-select py-1 text-xs"
                        >
                          {Object.keys(ROLE_COLORS).map((r) => (
                            <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider" style={{ color, backgroundColor: `${color}15` }}>
                          {m.role.replace(/_/g, " ")}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`text-xs ${m.is_active ? "text-[#34D399]" : "text-[#5A5650]"}`}>
                        {m.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-xs text-[#8A857D]">{new Date(m.joined_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                updateMutation.mutate(
                                  { slug, memberId: m.id, payload: { role: editRole } },
                                  { onSuccess: () => setEditId(null) },
                                );
                              }}
                              className="p-1 text-[#2DD4BF]"
                            >
                              <Save size={14} />
                            </button>
                            <button type="button" onClick={() => setEditId(null)} className="p-1 text-[#5A5650] hover:text-[#C5C0B8]"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => { setEditId(m.id); setEditRole(m.role); }} className="p-1 text-[#5A5650] hover:text-[#C5C0B8]"><Edit3 size={14} /></button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm("Remove this team member?")) removeMutation.mutate({ slug, memberId: m.id }); }}
                              className="p-1 text-[#5A5650] hover:text-[#E85A6B]"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
