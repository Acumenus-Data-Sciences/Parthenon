import { useState } from "react";
import { Loader2, Plus, Users, Trash2, Edit3, Save, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStudyTeam,
  useAddStudyTeamMember,
  useUpdateStudyTeamMember,
  useRemoveStudyTeamMember,
} from "../hooks/useStudies";
import { useUsers } from "@/features/administration/hooks/useAdminUsers";

const ROLES = [
  "principal_investigator",
  "co_investigator",
  "data_scientist",
  "statistician",
  "site_lead",
  "data_analyst",
  "research_coordinator",
  "irb_liaison",
  "project_manager",
  "observer",
] as const;

const ROLE_COLORS: Record<string, string> = {
  principal_investigator: "#2DD4BF",
  co_investigator: "#60A5FA",
  data_scientist: "#A78BFA",
  statistician: "#F59E0B",
  site_lead: "#34D399",
  data_analyst: "#FB923C",
  research_coordinator: "#818CF8",
  irb_liaison: "#F472B6",
  project_manager: "#22D3EE",
  observer: "#8A857D",
};

interface StudyTeamTabProps {
  slug: string;
}

export function StudyTeamTab({ slug }: StudyTeamTabProps) {
  const { data: members, isLoading } = useStudyTeam(slug);
  const { data: usersData } = useUsers();
  const addMutation = useAddStudyTeamMember();
  const updateMutation = useUpdateStudyTeamMember();
  const removeMutation = useRemoveStudyTeamMember();

  const [editId, setEditId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState("");

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [selectedRole, setSelectedRole] = useState<string>("data_analyst");
  const [userSearch, setUserSearch] = useState("");

  // Filter out users already on the team
  const existingUserIds = new Set(members?.map((m) => m.user_id) ?? []);
  const allUsers: { id: number; name: string; email: string }[] =
    (usersData as { data?: { id: number; name: string; email: string }[] } | undefined)?.data ?? [];
  const availableUsers = allUsers.filter((u) => !existingUserIds.has(u.id));
  const filteredUsers = userSearch
    ? availableUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.email?.toLowerCase().includes(userSearch.toLowerCase()),
      )
    : availableUsers;

  const handleCreate = () => {
    if (!selectedUserId) return;
    addMutation.mutate(
      {
        slug,
        payload: { user_id: selectedUserId as number, role: selectedRole },
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setSelectedUserId("");
          setSelectedRole("data_analyst");
          setUserSearch("");
        },
      },
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#8A857D]" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#C5C0B8]">Team Members ({members?.length ?? 0})</h3>
        <button type="button" onClick={() => setShowAdd(true)} disabled={showAdd} className="btn btn-primary btn-sm">
          <Plus size={14} /> Add Member
        </button>
      </div>

      {/* Add member form */}
      {showAdd && (
        <div className="panel space-y-3">
          <p className="text-xs font-medium text-[#C5C0B8] uppercase tracking-wider">Add Team Member</p>

          <div className="grid grid-cols-2 gap-3">
            {/* User search + select */}
            <div className="space-y-2">
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider block">User</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="form-input pl-9 w-full"
                  autoFocus
                />
              </div>
              {filteredUsers.length > 0 ? (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#232328] bg-[#0E0E11]">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => { setSelectedUserId(user.id); setUserSearch(user.name); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-[#1C1C20] transition-colors flex items-center gap-2",
                        selectedUserId === user.id ? "bg-[#2DD4BF]/10 text-[#2DD4BF]" : "text-[#F0EDE8]",
                      )}
                    >
                      <div className="w-6 h-6 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center text-[10px] font-medium text-[#2DD4BF] shrink-0">
                        {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium block truncate">{user.name}</span>
                        <span className="text-xs text-[#5A5650] block truncate">{user.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#5A5650] py-2">
                  {availableUsers.length === 0 ? "All users are already team members" : "No matching users"}
                </p>
              )}
            </div>

            {/* Role select */}
            <div>
              <label className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1 block">Role</label>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="form-input form-select w-full">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                ))}
              </select>
              <p className="text-[10px] text-[#5A5650] mt-2">
                {selectedRole === "principal_investigator" && "Lead researcher responsible for the study"}
                {selectedRole === "co_investigator" && "Contributing researcher with study oversight"}
                {selectedRole === "data_scientist" && "Develops and runs analytical pipelines"}
                {selectedRole === "statistician" && "Statistical analysis and methodology"}
                {selectedRole === "site_lead" && "Manages data partner site operations"}
                {selectedRole === "data_analyst" && "Data processing and quality checks"}
                {selectedRole === "research_coordinator" && "Coordinates study logistics and timelines"}
                {selectedRole === "irb_liaison" && "Manages IRB submissions and compliance"}
                {selectedRole === "project_manager" && "Overall project planning and tracking"}
                {selectedRole === "observer" && "Read-only access to study materials"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowAdd(false); setUserSearch(""); setSelectedUserId(""); }} className="btn btn-ghost btn-sm">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={!selectedUserId || addMutation.isPending} className="btn btn-primary btn-sm">
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Add Member
            </button>
          </div>
        </div>
      )}

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
                          {ROLES.map((r) => (
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
