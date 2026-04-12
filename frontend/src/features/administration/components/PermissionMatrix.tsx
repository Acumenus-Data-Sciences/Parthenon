/**
 * PermissionMatrix — shows all roles × all permissions in a grid.
 * Clicking any cell toggles that permission for that role.
 * Clicking a column header toggles all permissions for that role.
 * Clicking a row header toggles that permission across all roles.
 * Clicking a domain section header toggles all permissions in that domain for all roles.
 */

import { Fragment, useState } from "react";
import { Check, X, Minus, Loader2 } from "lucide-react";
import type { Role } from "@/types/models";
import type { PermissionsByDomain } from "../api/adminApi";
import { useUpdateRole } from "../hooks/useAdminRoles";

interface Props {
  roles: Role[];
  permissionsByDomain: PermissionsByDomain;
}

type Matrix = Record<string, Set<string>>; // roleName → Set<permissionName>

const PROTECTED_ROLES = ["super-admin"];

function buildMatrix(roles: Role[]): Matrix {
  return Object.fromEntries(
    roles.map((r) => [r.name, new Set(r.permissions?.map((p) => p.name) ?? [])]),
  );
}

export function PermissionMatrix({ roles, permissionsByDomain }: Props) {
  const [matrix, setMatrix] = useState<Matrix>(() => buildMatrix(roles));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const updateRole = useUpdateRole();

  const editableRoles = roles.filter((r) => !PROTECTED_ROLES.includes(r.name));
  const allDomains = Object.entries(permissionsByDomain).sort(([a], [b]) => a.localeCompare(b));

  const mark = (roleName: string) =>
    setDirty((d) => { const n = new Set(d); n.add(roleName); return n; });

  // Toggle single cell
  const toggleCell = (roleName: string, perm: string) => {
    if (PROTECTED_ROLES.includes(roleName)) return;
    setMatrix((m) => {
      const s = new Set(m[roleName]);
      if (s.has(perm)) {
        s.delete(perm);
      } else {
        s.add(perm);
      }
      return { ...m, [roleName]: s };
    });
    mark(roleName);
  };

  // Toggle entire column (all perms for one role)
  const toggleColumn = (roleName: string) => {
    if (PROTECTED_ROLES.includes(roleName)) return;
    const current = matrix[roleName];
    const all = allDomains.flatMap(([, ps]) => ps.map((p) => p.name));
    const allOn = all.every((p) => current.has(p));
    setMatrix((m) => ({ ...m, [roleName]: allOn ? new Set() : new Set(all) }));
    mark(roleName);
  };

  // Toggle entire row (one perm across all editable roles)
  const toggleRow = (perm: string) => {
    const allOn = editableRoles.every((r) => matrix[r.name].has(perm));
    setMatrix((m) => {
      const next = { ...m };
      editableRoles.forEach((r) => {
        const s = new Set(next[r.name]);
        if (allOn) {
          s.delete(perm);
        } else {
          s.add(perm);
        }
        next[r.name] = s;
      });
      return next;
    });
    editableRoles.forEach((r) => mark(r.name));
  };

  // Toggle domain row group across all editable roles
  const toggleDomainRow = (perms: Array<{ name: string }>) => {
    const allOn = editableRoles.every((r) =>
      perms.every((p) => matrix[r.name].has(p.name)),
    );
    setMatrix((m) => {
      const next = { ...m };
      editableRoles.forEach((r) => {
        const s = new Set(next[r.name]);
        perms.forEach((p) => {
          if (allOn) {
            s.delete(p.name);
          } else {
            s.add(p.name);
          }
        });
        next[r.name] = s;
      });
      return next;
    });
    editableRoles.forEach((r) => mark(r.name));
  };

  const saveRole = (roleName: string) => {
    const role = roles.find((r) => r.name === roleName);
    if (!role) return;
    setSaving((s) => { const n = new Set(s); n.add(roleName); return n; });
    updateRole.mutate(
      { id: role.id, data: { permissions: Array.from(matrix[roleName]) } },
      {
        onSuccess: () => {
          setSaving((s) => { const n = new Set(s); n.delete(roleName); return n; });
          setDirty((d) => { const n = new Set(d); n.delete(roleName); return n; });
          setSaved((s) => { const n = new Set(s); n.add(roleName); return n; });
          setTimeout(() => setSaved((s) => { const n = new Set(s); n.delete(roleName); return n; }), 2000);
        },
        onError: () => {
          setSaving((s) => { const n = new Set(s); n.delete(roleName); return n; });
        },
      },
    );
  };

  const saveAll = () => Array.from(dirty).forEach(saveRole);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-muted">
          Click cells to toggle permissions · row headers to apply across all roles ·
          column headers to grant/revoke all for a role.
        </p>
        {dirty.size > 0 && (
          <button
            type="button"
            onClick={saveAll}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-1.5 text-sm font-medium text-surface-base transition-colors hover:bg-success-dark shrink-0"
          >
            Save All Changes ({dirty.size} role{dirty.size > 1 ? "s" : ""})
          </button>
        )}
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-raised">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-default bg-surface-overlay">
              <th className="sticky left-0 z-10 w-48 bg-surface-overlay px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-ghost">
                Permission
              </th>
              {editableRoles.map((r) => (
                <th
                  key={r.id}
                  className="min-w-[8rem] cursor-pointer px-2 py-2.5 text-center transition-colors hover:bg-surface-elevated"
                  onClick={() => toggleColumn(r.name)}
                  title={`Toggle all permissions for ${r.name}`}
                >
                  <div className="font-semibold text-text-primary">{r.name}</div>
                  <div className="mt-0.5 font-normal text-text-ghost">
                    {matrix[r.name]?.size ?? 0} perms
                  </div>
                  {dirty.has(r.name) && (
                    <div className="mt-0.5">
                      {saving.has(r.name) ? (
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <Loader2 size={10} className="animate-spin" /> saving…
                        </span>
                      ) : saved.has(r.name) ? (
                        <span className="text-success">saved ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); saveRole(r.name); }}
                          className="text-success underline underline-offset-2 hover:text-success-dark"
                        >
                          save
                        </button>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDomains.map(([domain, perms]) => (
              <Fragment key={domain}>
                {/* Domain section header */}
                <tr
                  className="cursor-pointer border-t border-border-default bg-surface-overlay/60 transition-colors hover:bg-surface-overlay"
                  onClick={() => toggleDomainRow(perms)}
                  title={`Toggle all ${domain} permissions across all roles`}
                >
                  <td className="sticky left-0 z-10 bg-surface-overlay px-3 py-1.5 font-semibold capitalize text-text-secondary">
                    {domain}
                  </td>
                  {editableRoles.map((r) => {
                    const domOn = perms.every((p) => matrix[r.name]?.has(p.name));
                    const domSome = perms.some((p) => matrix[r.name]?.has(p.name));
                    return (
                      <td key={r.id} className="px-2 py-1.5 text-center">
                        {domOn ? (
                          <Check className="mx-auto h-3.5 w-3.5 text-success" />
                        ) : domSome ? (
                          <Minus className="mx-auto h-3.5 w-3.5 text-text-muted" />
                        ) : (
                          <X className="mx-auto h-3.5 w-3.5 text-critical/40" />
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Individual permission rows */}
                {perms.map((perm) => {
                  const action = perm.name.split(".")[1];
                  return (
                    <tr
                      key={perm.name}
                      className="border-t border-border-default/50 transition-colors hover:bg-surface-overlay/30"
                    >
                      <td
                        className="sticky left-0 z-10 cursor-pointer bg-surface-raised px-3 py-1 transition-colors hover:bg-surface-overlay"
                        onClick={() => toggleRow(perm.name)}
                        title={`Toggle ${perm.name} for all roles`}
                      >
                        <span className="pl-3 font-mono text-text-muted">{action}</span>
                      </td>
                      {editableRoles.map((r) => {
                        const on = matrix[r.name]?.has(perm.name);
                        return (
                          <td
                            key={r.id}
                            className="cursor-pointer px-2 py-1 text-center transition-colors hover:bg-surface-overlay/60"
                            onClick={() => toggleCell(r.name, perm.name)}
                            title={`${on ? "Revoke" : "Grant"} ${perm.name} from ${r.name}`}
                          >
                            {on ? (
                              <span className="mx-auto flex h-4 w-4 items-center justify-center rounded bg-success/15">
                                <Check className="h-3 w-3 text-success" />
                              </span>
                            ) : (
                              <X className="mx-auto h-3 w-3 text-critical/35" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
