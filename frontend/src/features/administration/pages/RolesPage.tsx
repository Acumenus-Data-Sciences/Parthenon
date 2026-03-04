import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, ShieldCheck, Grid3x3 } from "lucide-react";
import { Panel, Badge, Modal, Button, TabBar, TabPanel } from "@/components/ui";
import { useRoles, usePermissions, useCreateRole, useUpdateRole, useDeleteRole } from "../hooks/useAdminRoles";
import { PermissionMatrix } from "../components/PermissionMatrix";
import type { Role } from "@/types/models";

const PROTECTED = ["super-admin", "admin", "researcher", "data-steward", "mapping-reviewer", "viewer"];

const TABS = [
  { id: "roles", label: "Role List", icon: <ShieldCheck size={14} /> },
  { id: "matrix", label: "Permission Matrix", icon: <Grid3x3 size={14} /> },
];

// ── Inline role editor ────────────────────────────────────────────────────────

function RoleEditor({
  initial,
  permissionsByDomain,
  onSave,
  onCancel,
  isPending,
}: {
  initial: { name: string; permissions: string[] };
  permissionsByDomain: Record<string, Array<{ name: string }>>;
  onSave: (data: { name: string; permissions: string[] }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.permissions));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (perm: string) =>
    setSelected((s) => { const n = new Set(s); n.has(perm) ? n.delete(perm) : n.add(perm); return n; });

  const toggleDomain = (perms: Array<{ name: string }>) => {
    const all = perms.every((p) => selected.has(p.name));
    setSelected((s) => {
      const n = new Set(s);
      perms.forEach((p) => (all ? n.delete(p.name) : n.add(p.name)));
      return n;
    });
  };

  return (
    <Panel className="border-primary/30">
      <div className="mb-4">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Role Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. site-coordinator"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          Permissions ({selected.size} selected)
        </p>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {Object.entries(permissionsByDomain).sort().map(([domain, perms]) => {
            const allChecked = perms.every((p) => selected.has(p.name));
            const someChecked = perms.some((p) => selected.has(p.name));
            const open = expanded[domain] ?? false;

            return (
              <div key={domain} className="rounded-md border border-border">
                <div
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/50"
                  onClick={() => setExpanded((e) => ({ ...e, [domain]: !open }))}
                >
                  {open
                    ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                    onChange={(e) => { e.stopPropagation(); toggleDomain(perms); }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className="text-sm font-medium text-foreground capitalize">{domain}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {perms.filter((p) => selected.has(p.name)).length}/{perms.length}
                  </span>
                </div>
                {open && (
                  <div className="grid grid-cols-2 gap-1 border-t border-border px-3 py-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.name}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(perm.name)}
                          onChange={() => toggle(perm.name)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        <span className="text-xs font-mono text-foreground">
                          {perm.name.split(".")[1]}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!name.trim() || isPending}
          onClick={() => onSave({ name: name.trim(), permissions: Array.from(selected) })}
        >
          {isPending ? "Saving…" : "Save Role"}
        </Button>
      </div>
    </Panel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { data: roles, isLoading } = useRoles();
  const { data: permsByDomain } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [tab, setTab] = useState("roles");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define custom roles and fine-tune permission assignments. Use the matrix for bulk edits.
          </p>
        </div>
        {tab === "roles" && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Role
          </Button>
        )}
      </div>

      {/* Tab switcher — shared TabBar */}
      <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

      {/* Permission Matrix tab */}
      <TabPanel id="matrix" active={tab === "matrix"}>
        {roles && permsByDomain && (
          <PermissionMatrix roles={roles} permissionsByDomain={permsByDomain} />
        )}
      </TabPanel>

      {/* Role list tab */}
      <TabPanel id="roles" active={tab === "roles"}>
        {/* Create form */}
        {creating && permsByDomain && (
          <RoleEditor
            initial={{ name: "", permissions: [] }}
            permissionsByDomain={permsByDomain}
            isPending={createRole.isPending}
            onCancel={() => setCreating(false)}
            onSave={(data) =>
              createRole.mutate(data, { onSuccess: () => setCreating(false) })
            }
          />
        )}

        {/* Role cards */}
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-3">
            {roles?.map((role) => {
              const isProtected = PROTECTED.includes(role.name);
              const isEditing = editing?.id === role.id;

              return (
                <div key={role.id}>
                  {isEditing && permsByDomain ? (
                    <RoleEditor
                      initial={{
                        name: role.name,
                        permissions: role.permissions?.map((p) => p.name) ?? [],
                      }}
                      permissionsByDomain={permsByDomain}
                      isPending={updateRole.isPending}
                      onCancel={() => setEditing(null)}
                      onSave={(data) =>
                        updateRole.mutate(
                          { id: role.id, data },
                          { onSuccess: () => setEditing(null) },
                        )
                      }
                    />
                  ) : (
                    <Panel>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{role.name}</p>
                              {isProtected && (
                                <Badge variant="inactive">built-in</Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {role.users_count ?? 0} user
                              {role.users_count !== 1 ? "s" : ""} ·{" "}
                              {role.permissions?.length ?? 0} permissions
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {role.permissions?.slice(0, 8).map((p) => (
                                <Badge key={p.name} variant="default">
                                  {p.name}
                                </Badge>
                              ))}
                              {(role.permissions?.length ?? 0) > 8 && (
                                <span className="text-xs text-muted-foreground">
                                  +{(role.permissions?.length ?? 0) - 8} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-4">
                          {role.name !== "super-admin" && (
                            <Button variant="ghost" size="sm" icon onClick={() => setEditing(role)} title="Edit role">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {!isProtected && (
                            <Button variant="ghost" size="sm" icon onClick={() => setDeleteConfirm(role)} title="Delete role">
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Panel>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </TabPanel>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete role?"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              disabled={deleteRole.isPending}
              onClick={() => {
                if (deleteConfirm) {
                  deleteRole.mutate(deleteConfirm.id, {
                    onSuccess: () => setDeleteConfirm(null),
                  });
                }
              }}
            >
              {deleteRole.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        }
      >
        {deleteConfirm && (
          <p className="text-sm text-muted-foreground">
            The role <strong>{deleteConfirm.name}</strong> will be permanently deleted. Users
            assigned only this role will lose all permissions.
          </p>
        )}
      </Modal>
    </div>
  );
}
