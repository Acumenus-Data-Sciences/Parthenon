import { useState } from "react";
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Circle,
  Search, X, Loader2, UsersRound, ChevronUp, ChevronDown, Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUsers, useDeleteUser, useAvailableRoles } from "../hooks/useAdminUsers";
import { UserModal } from "../components/UserModal";
import { BroadcastEmailModal } from "../components/BroadcastEmailModal";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/models";
import type { UserFilters } from "../api/adminApi";

// ── Design tokens ────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  "super-admin":      "var(--primary)",
  "admin":            "var(--accent)",
  "researcher":       "var(--success)",
  "data-steward":     "var(--info)",
  "mapping-reviewer": "var(--domain-observation)",
  "viewer":           "var(--text-muted)",
};

// ── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLORS[role] ?? "var(--text-muted)";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {role}
    </span>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronUp size={12} className="text-surface-highlight" />;
  return dir === "asc"
    ? <ChevronUp size={12} className="text-success" />
    : <ChevronDown size={12} className="text-success" />;
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-overlay">
        <UsersRound size={24} className="text-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary">
        {loading ? "Loading…" : "No users found"}
      </h3>
      {!loading && (
        <p className="mt-2 text-sm text-text-muted">Try adjusting your search or filters.</p>
      )}
    </div>
  );
}

// ── Delete confirmation overlay ───────────────────────────────────────────────

function DeleteConfirmModal({
  user,
  isPending,
  onConfirm,
  onCancel,
}: {
  user: User;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border-default bg-surface-overlay shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">Delete user?</h2>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-ghost transition-colors hover:bg-surface-accent hover:text-text-muted"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-text-muted">
            <span className="font-semibold text-text-secondary">{user.name}</span>{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
              ({user.email})
            </span>{" "}
            will be permanently deleted and all their API tokens revoked.{" "}
            <span className="text-critical">This cannot be undone.</span>
          </p>
        </div>
        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border-default px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-muted transition-colors hover:border-surface-highlight hover:text-text-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B52238] disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const SORTABLE: Array<{ key: string; label: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "last_active_at", label: "Last Active" },
  { key: "created_at", label: "Joined" },
];

export default function UsersPage() {
  const [filters, setFilters] = useState<UserFilters>({
    page: 1, per_page: 20, sort_by: "created_at", sort_dir: "desc",
  });
  const [search, setSearch] = useState("");
  const [modalState, setModalState] = useState<{ open: boolean; user: User | null }>({
    open: false, user: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)();

  const { data, isLoading } = useUsers({ ...filters, search: search || undefined });
  const { data: roles } = useAvailableRoles();
  const deleteUser = useDeleteUser();

  const handleSort = (key: string) =>
    setFilters((f) => ({
      ...f,
      sort_by: key,
      sort_dir: f.sort_by === key && f.sort_dir === "asc" ? "desc" : "asc",
    }));

  const users = data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Users</h1>
          <p className="mt-1 text-sm text-text-muted">
            <span className="font-['IBM_Plex_Mono',monospace] text-text-secondary">
              {data?.total ?? 0}
            </span>{" "}
            total accounts
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowBroadcast(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              <Mail size={16} />
              Admin Emailer
            </button>
          )}
          <button
            type="button"
            onClick={() => setModalState({ open: true, user: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-surface-base transition-colors hover:bg-[#25B8A5]"
          >
            <Plus size={16} />
            New User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-9 pr-8 text-sm text-text-primary placeholder:text-text-ghost focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-muted"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Role filter */}
        <select
          value={filters.role ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value || undefined, page: 1 }))}
          className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary focus:border-success focus:outline-none transition-colors"
        >
          <option value="">All roles</option>
          {roles?.map((r) => (
            <option key={r.id} value={r.name}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading || users.length === 0 ? (
        <EmptyState loading={isLoading} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-default bg-surface-raised">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-overlay">
                {SORTABLE.map(({ key, label }) => (
                  <th
                    key={key}
                    className="px-4 py-2.5 text-left"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(key)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
                    >
                      {label}
                      <SortIcon
                        active={filters.sort_by === key}
                        dir={filters.sort_dir as "asc" | "desc"}
                      />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Roles
                </th>
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const activeAt = user.last_active_at;
                const isActive = user.is_active;
                return (
                  <tr
                    key={user.id}
                    className={cn(
                      "border-t border-surface-overlay transition-colors",
                      i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                    )}
                  >
                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase"
                          style={{ backgroundColor: "color-mix(in srgb, var(--success) 8%, transparent)", color: "var(--success)" }}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-text-secondary">{user.name}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3">
                      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
                        {user.email}
                      </span>
                    </td>

                    {/* Last Active */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Circle
                          size={7}
                          style={{
                            fill: isActive ? "var(--success)" : "var(--surface-highlight)",
                            color: isActive ? "var(--success)" : "var(--surface-highlight)",
                            flexShrink: 0,
                          }}
                        />
                        <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                          {activeAt ? new Date(activeAt).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          }) : "Never"}
                        </span>
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3">
                      <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-ghost">
                        {new Date(user.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </span>
                    </td>

                    {/* Roles */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.length ? (
                          (user.roles as Array<string | { name: string }>).map((r) => {
                            const name = typeof r === "string" ? r : r.name;
                            return <RoleBadge key={name} role={name} />;
                          })
                        ) : (
                          <span className="text-xs text-text-ghost">—</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setModalState({ open: true, user }); }}
                          title="Edit user"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-text-ghost transition-colors hover:bg-surface-elevated hover:text-text-muted"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(user); }}
                          title="Delete user"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-text-ghost transition-colors hover:bg-[color-mix(in srgb, var(--primary) 8%, transparent)] hover:text-critical"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-text-ghost">
          <span>
            Page{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
              {data.current_page}
            </span>{" "}
            of{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
              {data.last_page}
            </span>
            {" "}·{" "}
            <span className="font-['IBM_Plex_Mono',monospace] text-text-secondary">
              {data.total.toLocaleString()}
            </span>{" "}
            users
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.current_page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="inline-flex items-center justify-center rounded-lg border border-border-default bg-surface-raised p-1.5 text-text-muted transition-colors hover:border-surface-highlight hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={data.current_page === data.last_page}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="inline-flex items-center justify-center rounded-lg border border-border-default bg-surface-raised p-1.5 text-text-muted transition-colors hover:border-surface-highlight hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
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

      {/* Broadcast email modal (super-admin only) */}
      {showBroadcast && (
        <BroadcastEmailModal
          userCount={data?.total ?? 0}
          onClose={() => setShowBroadcast(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <DeleteConfirmModal
          user={deleteConfirm}
          isPending={deleteUser.isPending}
          onConfirm={() =>
            deleteUser.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) })
          }
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* Loading overlay */}
      {isLoading && users.length > 0 && (
        <div className="flex justify-center">
          <Loader2 size={18} className="animate-spin text-text-ghost" />
        </div>
      )}
    </div>
  );
}
