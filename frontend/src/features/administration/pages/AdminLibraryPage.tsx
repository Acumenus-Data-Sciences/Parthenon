import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Search, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { HardDeleteModal } from "../components/HardDeleteModal";
import { ReassignOwnerModal } from "../components/ReassignOwnerModal";
import { PurgeConfirmModal } from "../components/PurgeConfirmModal";
import { AdminBulkToolbar } from "../components/AdminBulkToolbar";
import {
  useAdminLibrary,
  usePurgeAdminLibrary,
  useRestoreAdminLibrary,
} from "../hooks/useAdminLibrary";
import {
  useAdminBulkLifecycle,
  useAdminSingleLifecycle,
  type AdminBulkLifecycleAction,
} from "../hooks/useAdminLifecycle";
import { adminItemTypeLabel } from "../lib/adminLibraryEntityMap";
import { LifecycleStatusBadge } from "@/features/library/components/LifecycleStatusBadge";
import {
  LifecycleActionMenu,
  type LifecycleAction,
} from "@/features/library/components/LifecycleActionMenu";
import { LifecycleConfirmModal } from "@/features/library/components/LifecycleConfirmModal";
import {
  StatusTabs,
  type StatusTab,
} from "@/features/library/components/StatusTabs";
import {
  ADMIN_LIBRARY_ITEM_TYPES,
  type AdminLibraryItemRef,
  type AdminLibraryItemType,
  type AdminLibraryRow,
  type AdminLibraryStatus,
} from "../api/adminLibraryApi";

type Tab = "active" | "trash";

type PendingLifecycle =
  | { kind: "row"; action: LifecycleAction; item: AdminLibraryItemRef; name: string | null }
  | { kind: "bulk"; action: AdminBulkLifecycleAction; items: AdminLibraryItemRef[] };

function rowKey(row: { item_type: AdminLibraryItemType; id: number }): string {
  return `${row.item_type}:${row.id}`;
}

export default function AdminLibraryPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [statusTab, setStatusTab] = useState<StatusTab>("active");
  const [typeFilter, setTypeFilter] = useState<AdminLibraryItemType | "">("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [pending, setPending] = useState<PendingLifecycle | null>(null);
  const [purgeTargets, setPurgeTargets] = useState<AdminLibraryItemRef[] | null>(
    null,
  );

  // Active tab fetches ALL statuses and filters client-side so the StatusTabs
  // counts stay accurate; Trash fetches the soft-deleted set.
  const { data, isLoading, error } = useAdminLibrary({
    type: typeFilter || undefined,
    status: tab === "trash" ? undefined : "all",
    search: search || undefined,
    include_trash: tab === "trash",
  });

  const restoreMut = useRestoreAdminLibrary();
  const purgeMut = usePurgeAdminLibrary();
  const singleLifecycle = useAdminSingleLifecycle();
  const bulkLifecycle = useAdminBulkLifecycle();

  const allRows = useMemo(() => data?.data ?? [], [data?.data]);

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = {
      active: 0,
      draft: 0,
      archived: 0,
      all: allRows.length,
    };
    for (const r of allRows) {
      if (r.status === "active" || r.status === "draft" || r.status === "archived") {
        c[r.status] += 1;
      }
    }
    return c;
  }, [allRows]);

  const rows = useMemo<AdminLibraryRow[]>(() => {
    if (tab === "trash") return allRows;
    if (statusTab === "all") return allRows;
    return allRows.filter((r) => r.status === statusTab);
  }, [allRows, tab, statusTab]);

  // Clear stale selection whenever the visible set changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
  }, [tab, statusTab, typeFilter, search]);

  function toggleRow(row: { item_type: AdminLibraryItemType; id: number }) {
    const k = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function selectAllVisible() {
    setSelected(new Set(rows.map(rowKey)));
  }

  const selectedItems: AdminLibraryItemRef[] = useMemo(
    () =>
      rows
        .filter((r) => selected.has(rowKey(r)))
        .map((r) => ({ type: r.item_type, id: r.id })),
    [rows, selected],
  );

  const isAllVisibleSelected =
    rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));

  const lifecyclePending = singleLifecycle.isPending || bulkLifecycle.isPending;

  function confirmLifecycle() {
    if (!pending) return;
    if (pending.kind === "bulk") {
      bulkLifecycle.mutate(
        { action: pending.action, items: pending.items },
        {
          onSuccess: () => {
            setPending(null);
            clearSelection();
          },
        },
      );
      return;
    }
    singleLifecycle.mutate(
      { action: pending.action, item: pending.item },
      { onSuccess: () => setPending(null) },
    );
  }

  const pendingCount = pending?.kind === "bulk" ? pending.items.length : 1;
  const pendingName = pending?.kind === "row" ? pending.name : null;
  // LifecycleConfirmModal copy only models promote/archive/restore. The admin
  // surface never bulk-promotes, so any pending action maps to a valid key.
  const pendingAction: LifecycleAction = pending?.action ?? "archive";

  const colCount = tab === "trash" ? 8 : 7;

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-text-primary">
          Library Administration
        </h1>
        <p className="text-sm text-text-muted">
          Cross-cuts every lifecycle-managed table — concept sets, cohort
          definitions, and analyses. Promote, archive, restore, reassign, or
          permanently delete any user&apos;s items. Super-admin only.
        </p>
      </header>

      {/* Active / Trash pill tabs */}
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-surface-overlay p-0.5">
        {(["active", "trash"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              clearSelection();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              tab === t
                ? "bg-surface-elevated text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {t === "active" ? "Active" : "Trash"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {tab === "active" && (
          <StatusTabs value={statusTab} counts={counts} onChange={setStatusTab} />
        )}
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="text-text-muted">Type</span>
          <select
            className="form-input py-1.5 text-xs"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as AdminLibraryItemType | "")
            }
          >
            <option value="">All types</option>
            {ADMIN_LIBRARY_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {adminItemTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost"
          />
          <input
            type="search"
            className="form-input w-full pl-9 py-1.5 text-xs"
            placeholder="Search name or description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk action bar — Active tab */}
      {tab === "active" && (
        <AdminBulkToolbar
          count={selectedItems.length}
          onArchive={() =>
            setPending({ kind: "bulk", action: "archive", items: selectedItems })
          }
          onRestore={() =>
            setPending({ kind: "bulk", action: "restore", items: selectedItems })
          }
          onDelete={() => setDeleteOpen(true)}
          onReassign={() => setReassignOpen(true)}
          onClear={clearSelection}
          isPending={lifecyclePending}
        />
      )}

      {/* Bulk action bar — Trash tab */}
      {tab === "trash" && selectedItems.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-surface-elevated/95 px-4 py-2 shadow-sm backdrop-blur"
        >
          <span className="text-sm font-medium text-text-primary">
            {selectedItems.length} selected
          </span>
          <span className="text-xs text-text-muted">·</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={restoreMut.isPending}
            onClick={() =>
              restoreMut.mutate(selectedItems, { onSuccess: clearSelection })
            }
          >
            <RotateCcw size={14} />
            Restore ({selectedItems.length})
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={purgeMut.isPending}
            onClick={() => setPurgeTargets(selectedItems)}
          >
            <Zap size={14} />
            Purge ({selectedItems.length})
          </Button>
          <span className="ml-auto" />
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Clear ${selectedItems.length} from selection`}
          >
            <X size={12} />
            Clear
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-text-muted" />
        </div>
      )}
      {error && (
        <p className="py-8 text-center text-status-critical">
          Failed to load admin library.
        </p>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-overlay text-[11px] uppercase tracking-wider text-text-muted">
                <th className="w-8 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    ref={(el) => {
                      if (el) {
                        const some = rows.some((r) => selected.has(rowKey(r)));
                        el.indeterminate = some && !isAllVisibleSelected;
                      }
                    }}
                    onChange={(e) =>
                      e.target.checked ? selectAllVisible() : clearSelection()
                    }
                    aria-label="Select all visible rows"
                    className="h-3.5 w-3.5 rounded border-border-default bg-surface-overlay accent-accent cursor-pointer"
                  />
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Owner</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold">Updated</th>
                {tab === "trash" && (
                  <th className="px-4 py-2.5 text-left font-semibold">Deleted</th>
                )}
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-4 py-12 text-center text-text-muted"
                  >
                    No items match the current filters.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => {
                const k = rowKey(row);
                const status = (row.status ?? "active") as AdminLibraryStatus;
                return (
                  <tr
                    key={k}
                    className={cn(
                      "border-t border-border-subtle transition-colors hover:bg-surface-overlay",
                      i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay/40",
                      selected.has(k) && "bg-accent/5",
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(k)}
                        onChange={() => toggleRow(row)}
                        aria-label={`Select ${row.item_type} ${row.id}`}
                        className="h-3.5 w-3.5 rounded border-border-default bg-surface-overlay accent-accent cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                        {adminItemTypeLabel(row.item_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">
                        {row.name ?? <em className="text-text-muted">—</em>}
                      </div>
                      {row.description && (
                        <div className="mt-0.5 max-w-[320px] truncate text-xs text-text-muted">
                          {row.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {row.owner ? (
                        <span
                          title={row.owner.email}
                          className="text-text-secondary"
                        >
                          {row.owner.name}
                        </span>
                      ) : (
                        <em className="text-text-muted">unowned</em>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LifecycleStatusBadge status={status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {row.updated_at?.slice(0, 10) ?? "—"}
                    </td>
                    {tab === "trash" && (
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {row.deleted_at?.slice(0, 10) ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {tab === "active" ? (
                        <LifecycleActionMenu
                          status={status}
                          disabled={lifecyclePending}
                          onAction={(action) =>
                            setPending({
                              kind: "row",
                              action,
                              item: { type: row.item_type, id: row.id },
                              name: row.name,
                            })
                          }
                        />
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={restoreMut.isPending}
                            onClick={() =>
                              restoreMut.mutate([
                                { type: row.item_type, id: row.id },
                              ])
                            }
                          >
                            <RotateCcw size={14} />
                            Restore
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={purgeMut.isPending}
                            onClick={() =>
                              setPurgeTargets([
                                { type: row.item_type, id: row.id },
                              ])
                            }
                          >
                            <Zap size={14} />
                            Purge
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <HardDeleteModal
        open={deleteOpen}
        items={selectedItems}
        onClose={() => setDeleteOpen(false)}
        onDeleted={clearSelection}
      />
      <ReassignOwnerModal
        open={reassignOpen}
        items={selectedItems}
        onClose={() => setReassignOpen(false)}
      />
      <LifecycleConfirmModal
        open={pending !== null}
        action={pendingAction}
        count={pendingCount}
        itemName={pendingName}
        itemNoun="items"
        isPending={lifecyclePending}
        onConfirm={confirmLifecycle}
        onClose={() => {
          if (!lifecyclePending) setPending(null);
        }}
      />
      <PurgeConfirmModal
        open={purgeTargets !== null}
        items={purgeTargets ?? []}
        isPending={purgeMut.isPending}
        onConfirm={() => {
          if (!purgeTargets) return;
          purgeMut.mutate(purgeTargets, {
            onSuccess: () => {
              setPurgeTargets(null);
              clearSelection();
            },
          });
        }}
        onClose={() => {
          if (!purgeMut.isPending) setPurgeTargets(null);
        }}
      />
    </div>
  );
}
