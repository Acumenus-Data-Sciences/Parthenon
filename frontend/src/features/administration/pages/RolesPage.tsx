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
    <div className="rounded-lg border border-[#2DD4BF]/30 bg-[#151518] p-5">
      <div className="mb-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          Role Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. site-coordinator"
          className="mt-1.5 w-full rounded-lg border border-[#323238] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]/30"
        />
      </div>

      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          Permissions{" "}
          <span className="text-[#2DD4BF]">({selected.size} selected)</span>
        </p>
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {Object.entries(permissionsByDomain)
            .sort()
            .map(([domain, perms]) => {
              const allChecked = perms.every((p) => selected.has(p.name));
              const someChecked = perms.some((p) => selected.has(p.name));
              const open = expanded[domain] ?? false;

              return (
                <div key={domain} className="rounded-lg border border-[#232328] bg-[#0E0E11]">
                  <div
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-[#1C1C20]"
                    onClick={() => setExpanded((e) => ({ ...e, [domain]: !open }))}
                  >
                    {open
                      ? <ChevronDown className="h-3 w-3 text-[#5A5650]" />
                      : <ChevronRight className="h-3 w-3 text-[#5A5650]" />}
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                      onChange={(e) => { e.stopPropagation(); toggleDomain(perms); }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 accent-[#2DD4BF]"
                    />
                    <span className="text-sm font-medium capitalize text-[#C5C0B8]">{domain}</span>
                    <span className="ml-auto text-xs text-[#5A5650]">
                      {perms.filter((p) => selected.has(p.name)).length}/{perms.length}
                    </span>
                  </div>
                  {open && (
                    <div className="grid grid-cols-2 gap-1 border-t border-[#232328] px-3 py-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.name}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-[#1C1C20]"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(perm.name)}
                            onChange={() => toggle(perm.name)}
                            className="h-3.5 w-3.5 accent-[#2DD4BF]"
                          />
                          <span className="font-mono text-xs text-[#8A857D]">
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

      <div className="flex justify-end gap-2 border-t border-[#232328] pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#323238] px-4 py-2 text-sm text-[#8A857D] transition-colors hover:border-[#5A5650] hover:text-[#F0EDE8]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim() || isPending}
          onClick={() => onSave({ name: name.trim(), permissions: Array.from(selected) })}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5] disabled:opacity-50"
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
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Roles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Define custom roles and fine-tune permission assignments. Use the matrix for bulk edits.
          </p>
        </div>
        {tab === "roles" && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5]"
          >
            <Plus size={16} />
            New Role
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex w-fit items-center gap-1 rounded-lg border border-[#232328] bg-[#0E0E11] p-0.5">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === id
                ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                : "text-[#8A857D] hover:text-[#C5C0B8]",
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
              <Loader2 size={20} className="animate-spin text-[#8A857D]" />
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
                      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 transition-colors hover:border-[#3A3A40]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-md bg-[#2DD4BF]/10 p-1.5 shrink-0">
                              <ShieldCheck className="h-4 w-4 text-[#2DD4BF]" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-[#F0EDE8]">{role.name}</p>
                                {isProtected && (
                                  <span className="inline-flex items-center rounded-full border border-[#323238] bg-[#1C1C20] px-2 py-0.5 text-[10px] font-medium text-[#8A857D]">
                                    built-in
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-[#5A5650]">
                                {role.users_count ?? 0} user{role.users_count !== 1 ? "s" : ""}{" "}
                                · {role.permissions?.length ?? 0} permissions
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {role.permissions?.slice(0, 8).map((p) => (
                                  <span
                                    key={p.name}
                                    className="inline-flex items-center rounded border border-[#323238] bg-[#1C1C20] px-1.5 py-0.5 font-mono text-[10px] text-[#8A857D]"
                                  >
                                    {p.name}
                                  </span>
                                ))}
                                {(role.permissions?.length ?? 0) > 8 && (
                                  <span className="text-[10px] text-[#5A5650]">
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
                                className="rounded-md p-1.5 text-[#5A5650] transition-colors hover:bg-[#232328] hover:text-[#F0EDE8]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {!isProtected && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(role)}
                                title="Delete role"
                                className="rounded-md p-1.5 text-[#5A5650] transition-colors hover:bg-[#E85A6B]/10 hover:text-[#E85A6B]"
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
            className="absolute inset-0 bg-[#0E0E11]/80 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-[#323238] bg-[#151518] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-base font-semibold text-[#F0EDE8]">Delete role?</h2>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="text-[#5A5650] transition-colors hover:text-[#F0EDE8]"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-6 text-sm text-[#8A857D]">
              The role{" "}
              <strong className="text-[#F0EDE8]">{deleteConfirm.name}</strong> will be permanently
              deleted. Users assigned only this role will lose all permissions.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg border border-[#323238] px-4 py-2 text-sm text-[#8A857D] transition-colors hover:border-[#5A5650] hover:text-[#F0EDE8]"
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
                className="inline-flex items-center gap-2 rounded-lg bg-[#E85A6B] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#D14D5E] disabled:opacity-50"
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
