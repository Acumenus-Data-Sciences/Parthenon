import { useState } from "react";
import {
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2,
} from "lucide-react";
import {
  DataTable, Badge, Modal, Button, SearchBar,
  type Column, type BadgeVariant,
} from "@/components/ui";
import { useUsers, useDeleteUser, useAvailableRoles } from "../hooks/useAdminUsers";
import { UserModal } from "../components/UserModal";
import type { User } from "@/types/models";
import type { UserFilters } from "../api/adminApi";

const ROLE_VARIANTS: Record<string, BadgeVariant> = {
  "super-admin": "critical",
  "admin": "warning",
  "researcher": "info",
  "data-steward": "primary",
  "mapping-reviewer": "accent",
  "viewer": "inactive",
};

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

  const handleSort = (key: string) =>
    setFilters((f) => ({
      ...f,
      sort_by: key,
      sort_dir: f.sort_by === key && f.sort_dir === "asc" ? "desc" : "asc",
    }));

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary uppercase">
            {user.name.charAt(0)}
          </div>
          <span className="font-medium">{user.name}</span>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      mono: true,
      render: (user) => <span className="text-xs">{user.email}</span>,
    },
    {
      key: "roles",
      header: "Roles",
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles?.length ? (
            user.roles.map((r) => {
              const roleName = typeof r === "string" ? r : (r as { name: string }).name;
              return (
                <Badge key={roleName} variant={ROLE_VARIANTS[roleName] ?? "default"}>
                  {roleName}
                </Badge>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      key: "last_login_at",
      header: "Last Login",
      sortable: true,
      render: (user) => (
        <span className="text-xs text-muted-foreground">
          {user.last_login_at
            ? new Date(user.last_login_at).toLocaleString()
            : "Never"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      sortable: true,
      render: (user) => (
        <span className="text-xs text-muted-foreground">
          {new Date(user.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "80px",
      render: (user) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon
            onClick={(e) => { e.stopPropagation(); setModalState({ open: true, user }); }}
            title="Edit user"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon
            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(user); }}
            title="Delete user"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

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
        <Button variant="primary" onClick={() => setModalState({ open: true, user: null })}>
          <Plus className="h-4 w-4 mr-1" /> New User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <SearchBar
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }}
          className="flex-1 max-w-sm"
        />
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
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        rowKey={(u) => u.id}
        sortKey={filters.sort_by}
        sortDir={filters.sort_dir}
        onSort={handleSort}
        emptyMessage={isLoading ? "Loading…" : "No users found."}
      />

      {/* Pagination */}
      {data && data.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.current_page} of {data.last_page} ({data.total} users)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon
              disabled={data.current_page === 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon
              disabled={data.current_page === data.last_page}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
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
      <Modal
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete user?"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleteUser.isPending}
              onClick={() => {
                if (deleteConfirm) {
                  deleteUser.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) });
                }
              }}
            >
              {deleteUser.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        }
      >
        {deleteConfirm && (
          <p className="text-sm text-muted-foreground">
            <strong>{deleteConfirm.name}</strong> ({deleteConfirm.email}) will be permanently deleted
            and all their API tokens revoked. This cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}
