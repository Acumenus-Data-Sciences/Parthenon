/**
 * PermissionMatrix — shows all roles × all permissions in a grid.
 * Clicking any cell toggles that permission for that role.
 * Clicking a column header toggles all permissions for that role.
 * Clicking a row header toggles that permission across all roles.
 * Clicking a domain section header toggles all permissions in that domain for all roles.
 *
 * Designed for admins who need to quickly replicate or compare permissions
 * across multiple roles without editing each role individually.
 */

import { useState, useMemo } from "react";
import { Check, Minus } from "lucide-react";
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
      s.has(perm) ? s.delete(perm) : s.add(perm);
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
        allOn ? s.delete(perm) : s.add(perm);
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
        perms.forEach((p) => (allOn ? s.delete(p.name) : s.add(p.name)));
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click cells to toggle individual permissions, row headers to apply across all roles,
          or column headers to grant/revoke all permissions for a role.
        </p>
        {dirty.size > 0 && (
          <button
            onClick={saveAll}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save All Changes ({dirty.size} role{dirty.size > 1 ? "s" : ""})
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            {/* Role name headers */}
            <tr className="border-b border-border bg-muted/50">
              <th className="w-48 px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10">
                Permission
              </th>
              {editableRoles.map((r) => (
                <th
                  key={r.id}
                  className="px-2 py-2 text-center min-w-[7rem] cursor-pointer hover:bg-accent"
                  onClick={() => toggleColumn(r.name)}
                  title={`Toggle all permissions for ${r.name}`}
                >
                  <div className="font-medium text-foreground">{r.name}</div>
                  <div className="text-muted-foreground font-normal mt-0.5">
                    {matrix[r.name]?.size ?? 0} perms
                  </div>
                  {dirty.has(r.name) && (
                    <div className="mt-0.5">
                      {saving.has(r.name) ? (
                        <span className="text-muted-foreground">saving…</span>
                      ) : saved.has(r.name) ? (
                        <span className="text-green-600">saved</span>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); saveRole(r.name); }}
                          className="text-primary underline underline-offset-2"
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
            {allDomains.map(([domain, perms]) => {
              const domainAllOn = editableRoles.every((r) =>
                perms.every((p) => matrix[r.name]?.has(p.name)),
              );
              const domainSomeOn = editableRoles.some((r) =>
                perms.some((p) => matrix[r.name]?.has(p.name)),
              );

              return (
                <>
                  {/* Domain section header row */}
                  <tr
                    key={`domain-${domain}`}
                    className="bg-muted/30 border-t border-border cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleDomainRow(perms)}
                    title={`Toggle all ${domain} permissions across all roles`}
                  >
                    <td className="px-3 py-1.5 font-semibold text-foreground capitalize sticky left-0 bg-muted/30 z-10">
                      {domain}
                    </td>
                    {editableRoles.map((r) => {
                      const domOn = perms.every((p) => matrix[r.name]?.has(p.name));
                      const domSome = perms.some((p) => matrix[r.name]?.has(p.name));
                      return (
                        <td key={r.id} className="px-2 py-1.5 text-center">
                          {domOn ? (
                            <Check className="mx-auto h-3.5 w-3.5 text-primary" />
                          ) : domSome ? (
                            <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground" />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Individual permission rows */}
                  {perms.map((perm) => {
                    const allOn = editableRoles.every((r) => matrix[r.name]?.has(perm.name));
                    const action = perm.name.split(".")[1];

                    return (
                      <tr
                        key={perm.name}
                        className="border-t border-border/50 hover:bg-muted/20"
                      >
                        <td
                          className="px-3 py-1 cursor-pointer sticky left-0 bg-background z-10 hover:bg-accent"
                          onClick={() => toggleRow(perm.name)}
                          title={`Toggle ${perm.name} for all roles`}
                        >
                          <span className="font-mono text-muted-foreground pl-3">{action}</span>
                        </td>
                        {editableRoles.map((r) => {
                          const on = matrix[r.name]?.has(perm.name);
                          return (
                            <td
                              key={r.id}
                              className="px-2 py-1 text-center cursor-pointer hover:bg-accent/60"
                              onClick={() => toggleCell(r.name, perm.name)}
                              title={`${on ? "Revoke" : "Grant"} ${perm.name} from ${r.name}`}
                            >
                              {on && (
                                <span className="mx-auto flex h-4 w-4 items-center justify-center rounded bg-primary/15">
                                  <Check className="h-3 w-3 text-primary" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
