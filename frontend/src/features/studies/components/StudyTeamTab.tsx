import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Users, Trash2, Edit3, Save, X, Search } from "lucide-react";
import { formatDate } from "@/i18n/format";
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
  principal_investigator: "var(--success)",
  co_investigator: "var(--info)",
  data_scientist: "var(--domain-observation)",
  statistician: "var(--warning)",
  site_lead: "var(--success)",
  data_analyst: "var(--domain-device)",
  research_coordinator: "var(--info)",
  irb_liaison: "var(--domain-procedure)",
  project_manager: "var(--info)",
  observer: "var(--text-muted)",
};

interface StudyTeamTabProps {
  slug: string;
}

export function StudyTeamTab({ slug }: StudyTeamTabProps) {
  const { t } = useTranslation("app");
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

  const roleLabel = (role: string) =>
    t(`studies.team.roles.${role}`, { defaultValue: role.replace(/_/g, " ") });

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
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-muted" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary">
          {t("studies.team.sections.members", { count: members?.length ?? 0 })}
        </h3>
        <button type="button" onClick={() => setShowAdd(true)} disabled={showAdd} className="btn btn-primary btn-sm">
          <Plus size={14} /> {t("studies.team.actions.addMember")}
        </button>
      </div>

      {/* Add member form */}
      {showAdd && (
        <div className="panel space-y-3">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {t("studies.team.form.addTitle")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* User search + select */}
            <div className="space-y-2">
              <label className="text-[10px] text-text-ghost uppercase tracking-wider block">
                {t("studies.team.form.user")}
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder={t("studies.team.form.userSearchPlaceholder")}
                  className="form-input pl-9 w-full"
                  autoFocus
                />
              </div>
              {filteredUsers.length > 0 ? (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-border-default bg-surface-base">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => { setSelectedUserId(user.id); setUserSearch(user.name); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-surface-overlay transition-colors flex items-center gap-2",
                        selectedUserId === user.id ? "bg-success/10 text-success" : "text-text-primary",
                      )}
                    >
                      <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center text-[10px] font-medium text-success shrink-0">
                        {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium block truncate">{user.name}</span>
                        <span className="text-xs text-text-ghost block truncate">{user.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-ghost py-2">
                  {availableUsers.length === 0
                    ? t("studies.team.messages.allUsersAssigned")
                    : t("studies.team.messages.noMatchingUsers")}
                </p>
              )}
            </div>

            {/* Role select */}
            <div>
              <label className="text-[10px] text-text-ghost uppercase tracking-wider mb-1 block">
                {t("studies.team.form.role")}
              </label>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="form-input form-select w-full">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
              <p className="text-[10px] text-text-ghost mt-2">
                {t(`studies.team.roleDescriptions.${selectedRole}`)}
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowAdd(false); setUserSearch(""); setSelectedUserId(""); }} className="btn btn-ghost btn-sm">
              {t("studies.team.actions.cancel")}
            </button>
            <button type="button" onClick={handleCreate} disabled={!selectedUserId || addMutation.isPending} className="btn btn-primary btn-sm">
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t("studies.team.actions.addMember")}
            </button>
          </div>
        </div>
      )}

      {(!members || members.length === 0) ? (
        <div className="empty-state">
          <Users size={24} className="text-text-ghost mb-2" />
          <h3 className="empty-title">{t("studies.team.empty.title")}</h3>
          <p className="empty-message">{t("studies.team.empty.message")}</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("studies.team.table.name")}</th>
                <th>{t("studies.team.table.email")}</th>
                <th>{t("studies.team.table.role")}</th>
                <th>{t("studies.team.table.status")}</th>
                <th>{t("studies.team.table.joined")}</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isEditing = editId === m.id;
                const color = ROLE_COLORS[m.role] ?? "var(--text-muted)";
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center text-[10px] font-medium text-success">
                          {m.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-text-primary font-medium">
                          {m.user?.name ?? t("studies.team.messages.userFallback", { id: m.user_id })}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-text-muted">{m.user?.email ?? "—"}</td>
                    <td>
                      {isEditing ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="form-input form-select py-1 text-xs"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>{roleLabel(r)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider" style={{ color, backgroundColor: `${color}15` }}>
                          {roleLabel(m.role)}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`text-xs ${m.is_active ? "text-success" : "text-text-ghost"}`}>
                        {m.is_active ? t("studies.team.statuses.active") : t("studies.team.statuses.inactive")}
                      </span>
                    </td>
                    <td className="text-xs text-text-muted">{formatDate(m.joined_at)}</td>
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
                              className="p-1 text-success"
                              title={t("studies.team.actions.save")}
                            >
                              <Save size={14} />
                            </button>
                            <button type="button" onClick={() => setEditId(null)} className="p-1 text-text-ghost hover:text-text-secondary" title={t("studies.team.actions.cancel")}>
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => { setEditId(m.id); setEditRole(m.role); }} className="p-1 text-text-ghost hover:text-text-secondary" title={t("studies.team.actions.edit")}>
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm(t("studies.team.confirmRemove"))) removeMutation.mutate({ slug, memberId: m.id }); }}
                              className="p-1 text-text-ghost hover:text-critical"
                              title={t("studies.team.actions.remove")}
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
