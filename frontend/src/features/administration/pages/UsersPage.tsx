import { useState } from "react";
import {
  Search, Plus, ChevronLeft, ChevronRight,
  ArrowUpDown, Pencil, Trash2, ShieldCheck, MoreHorizontal,
} from "lucide-react";
import { useUsers, useDeleteUser, useAvailableRoles } from "../hooks/useAdminUsers";
import { UserModal } from "../components/UserModal";
import type { User } from "@/types/models";
import type { UserFilters } from "../api/adminApi";

const ROLE_COLORS: Record<string, string> = {
  "super-admin":      "bg-red-500/15 text-red-600",
  "admin":            "bg-orange-500/15 text-orange-600",
  "researcher":       "bg-blue-500/15 text-blue-600",
  "data-steward":     "bg-teal-500/15 text-teal-600",
  "mapping-reviewer": "bg-purple-500/15 text-purple-600",
  "viewer":           "bg-zinc-500/15 text-zinc-500",
};

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {role}
    </span>
  );
}

export default function UsersPage() {
  const [filters, setFilters] = useState<UserFilters>({
    page: 1, per_page: 20, sort_by: "created_at", sort_dir: "desc",
  });
  const [search, setSearch] = useState("");
  const [modalState, setModalState] = useState<{ open: boolean; user: User | null }>({
    open: false, user: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);

  const { data, isLoading } = useUsers({ ...filters, search: search || undefined });
  const { data: roles } = useAvailableRoles();
  const deleteUser = useDeleteUser();

  const setSort = (field: string) =>
    setFilters((f) => ({
      ...f,
      sort_by: field,
      sort_dir: f.sort_by === field && f.sort_dir === "asc" ? "desc" : "asc",
    }));

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown
      className={`ml-1 inline h-3 w-3 ${filters.sort_by === field ? "text-primary" : "text-muted-foreground"}`}
    />
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.total ?? 0} total accounts
          </p>
        </div>
        <button
          onClick={() => setModalState({ open: true, user: null })}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filters.role ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value || undefined, page: 1 }))}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All roles</option>
          {roles?.map((r) => (
            <option key={r.id} value={r.name}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer" onClick={() => setSort("name")}>
                Name <SortIcon field="name" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer" onClick={() => setSort("email")}>
                Email <SortIcon field="email" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Roles</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer" onClick={() => setSort("last_login_at")}>
                Last Login <SortIcon field="last_login_at" />
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer" onClick={() => setSort("created_at")}>
                Joined <SortIcon field="created_at" />
              </th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : data?.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found.</td>
              </tr>
            ) : (
              data?.data.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary uppercase">
                        {user.name.charAt(0)}
                      </div>
                      {user.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles?.map((r) => <RoleBadge key={r} role={r} />) ?? <span className="text-muted-foreground text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModalState({ open: true, user })}
                        className="rounded p-1 hover:bg-accent"
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(user)}
                        className="rounded p-1 hover:bg-destructive/10"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.current_page} of {data.last_page} ({data.total} users)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={data.current_page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="rounded-md border border-border p-1 disabled:opacity-40 hover:bg-accent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={data.current_page === data.last_page}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="rounded-md border border-border p-1 disabled:opacity-40 hover:bg-accent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modalState.open && (
        <UserModal
          user={modalState.user}
          roles={roles ?? []}
          onClose={() => setModalState({ open: false, user: null })}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Delete user?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>{deleteConfirm.name}</strong> ({deleteConfirm.email}) will be permanently deleted
              and all their API tokens revoked. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteUser.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) });
                }}
                disabled={deleteUser.isPending}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteUser.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
