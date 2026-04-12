import { useState } from "react";
import {
  Plus, ChevronDown, ChevronRight, Pencil, Trash2,
  ShieldCheck, Grid3x3, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoles, usePermissions, useCreateRole, useUpdateRole, useDeleteRole } from "../hooks/useAdminRoles";
import { PermissionMatrix } from "../components/PermissionMatrix";
import type { Role } from "@/types/models";

const PROTECTED = ["super-admin", "admin", "researcher", "data-steward", "mapping-reviewer", "viewer"];

const TABS = [
  { id: "roles", label: "Role List", icon: <ShieldCheck size={14} /> },
  { id: "matrix", label: "Permission Matrix", icon: <Grid3x3 size={14} /> },
];

// ── Inline role editor ─────────────────────────────────────────────────────

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
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(perm)) {
        n.delete(perm);
      } else {
        n.add(perm);
      }
      return n;
    });

  const toggleDomain = (perms: Array<{ name: string }>) => {
    const all = perms.every((p) => selected.has(p.name));
    setSelected((s) => {
      const n = new Set(s);
      perms.forEach((p) => {
        if (all) {
          n.delete(p.name);
        } else {
          n.add(p.name);
        }
      });
      return n;
    });
  };

  return (
    <div className="rounded-lg border border-success/30 bg-surface-raised p-5">
      <div className="mb-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Role Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. site-coordinator"
          className="mt-1.5 w-full rounded-lg border border-surface-highlight bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success/30"
        />
      </div>

      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Permissions{" "}
          <span className="text-success">({selected.size} selected)</span>
        </p>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {Object.entries(permissionsByDomain)
            .sort()
            .map(([domain, perms]) => {
              const allChecked = perms.every((p) => selected.has(p.name));
              const someChecked = perms.some((p) => selected.has(p.name));
              const open = expanded[domain] ?? false;

              return (
                <div key={domain} className="rounded-lg border border-border-default bg-surface-base">
                  <div
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-overlay"
                    onClick={() => setExpanded((e) => ({ ...e, [domain]: !open }))}
                  >
                    {open
                      ? <ChevronDown className="h-3 w-3 text-text-ghost" />
                      : <ChevronRight className="h-3 w-3 text-text-ghost" />}
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                      onChange={(e) => { e.stopPropagation(); toggleDomain(perms); }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 accent-success"
                    />
                    <span className="text-sm font-medium capitalize text-text-secondary">{domain}</span>
                    <span className="ml-auto text-xs text-text-ghost">
                      {perms.filter((p) => selected.has(p.name)).length}/{perms.length}
                    </span>
                  </div>
                  {open && (
                    <div className="grid grid-cols-2 gap-1 border-t border-border-default px-3 py-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.name}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-surface-overlay"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(perm.name)}
                            onChange={() => toggle(perm.name)}
                            className="h-3.5 w-3.5 accent-success"
                          />
                          <span className="font-mono text-xs text-text-muted">
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

      <div className="flex justify-end gap-2 border-t border-border-default pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-surface-highlight px-4 py-2 text-sm text-text-muted transition-colors hover:border-text-ghost hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim() || isPending}
          onClick={() => onSave({ name: name.trim(), permissions: Array.from(selected) })}
          className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success disabled:opacity-50"
        >
          {isPending && <Loader2 size={14} className="animate-spin" />}
          {isPending ? "Saving…" : "Save Role"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

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
          <h1 className="text-2xl font-bold text-text-primary">Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-text-muted">
            Define custom roles and fine-tune permission assignments. Use the matrix for bulk edits.
          </p>
        </div>
        {tab === "roles" && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-surface-base transition-colors hover:bg-success"
          >
            <Plus size={16} />
            New Role
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex w-fit items-center gap-1 rounded-lg border border-border-default bg-surface-base p-0.5">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === id
                ? "bg-success/10 text-success"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Permission Matrix tab */}
      {tab === "matrix" && roles && permsByDomain && (
        <PermissionMatrix roles={roles} permissionsByDomain={permsByDomain} />
      )}

      {/* Role list tab */}
      {tab === "roles" && (
        <div className="space-y-4">
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
            <div className="flex h-32 items-center justify-center">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
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
                      <div className="rounded-lg border border-border-default bg-surface-raised p-4 transition-colors hover:border-surface-highlight">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-md bg-success/10 p-1.5 shrink-0">
                              <ShieldCheck className="h-4 w-4 text-success" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-text-primary">{role.name}</p>
                                {isProtected && (
                                  <span className="inline-flex items-center rounded-full border border-surface-highlight bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-text-muted">
                                    built-in
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-text-ghost">
                                {role.users_count ?? 0} user{role.users_count !== 1 ? "s" : ""}{" "}
                                · {role.permissions?.length ?? 0} permissions
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {role.permissions?.slice(0, 8).map((p) => (
                                  <span
                                    key={p.name}
                                    className="inline-flex items-center rounded border border-surface-highlight bg-surface-overlay px-1.5 py-0.5 font-mono text-[10px] text-text-muted"
                                  >
                                    {p.name}
                                  </span>
                                ))}
                                {(role.permissions?.length ?? 0) > 8 && (
                                  <span className="text-[10px] text-text-ghost">
                                    +{(role.permissions?.length ?? 0) - 8} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {role.name !== "super-admin" && (
                              <button
                                type="button"
                                onClick={() => setEditing(role)}
                                title="Edit role"
                                className="rounded-md p-1.5 text-text-ghost transition-colors hover:bg-surface-elevated hover:text-text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {!isProtected && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(role)}
                                title="Delete role"
                                className="rounded-md p-1.5 text-text-ghost transition-colors hover:bg-critical/10 hover:text-critical"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-surface-highlight bg-surface-raised p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-base font-semibold text-text-primary">Delete role?</h2>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="text-text-ghost transition-colors hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-6 text-sm text-text-muted">
              The role{" "}
              <strong className="text-text-primary">{deleteConfirm.name}</strong> will be permanently
              deleted. Users assigned only this role will lose all permissions.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-surface-highlight px-4 py-2 text-sm text-text-muted transition-colors hover:border-text-ghost hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteRole.isPending}
                onClick={() => {
                  deleteRole.mutate(deleteConfirm.id, {
                    onSuccess: () => setDeleteConfirm(null),
                  });
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-critical px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-critical disabled:opacity-50"
              >
                {deleteRole.isPending && <Loader2 size={14} className="animate-spin" />}
                {deleteRole.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
