import { useMemo, useState } from "react";
import { Loader2, Trash2, UserCog, RotateCcw, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HardDeleteModal } from "../components/HardDeleteModal";
import { ReassignOwnerModal } from "../components/ReassignOwnerModal";
import {
  useAdminLibrary,
  usePurgeAdminLibrary,
  useRestoreAdminLibrary,
} from "../hooks/useAdminLibrary";
import {
  ADMIN_LIBRARY_ITEM_TYPES,
  type AdminLibraryItemRef,
  type AdminLibraryItemType,
  type AdminLibraryStatus,
} from "../api/adminLibraryApi";

type Tab = "active" | "trash";

const STATUSES: AdminLibraryStatus[] = ["active", "draft", "archived"];

function rowKey(row: { item_type: AdminLibraryItemType; id: number }): string {
  return `${row.item_type}:${row.id}`;
}

export default function AdminLibraryPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [typeFilter, setTypeFilter] = useState<AdminLibraryItemType | "">("");
  const [statusFilter, setStatusFilter] = useState<AdminLibraryStatus | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  const { data, isLoading, error } = useAdminLibrary({
    type: typeFilter || undefined,
    status: tab === "trash" ? undefined : statusFilter || undefined,
    search: search || undefined,
    include_trash: tab === "trash",
  });

  const restoreMut = useRestoreAdminLibrary();
  const purgeMut = usePurgeAdminLibrary();

  const rows = useMemo(() => data?.data ?? [], [data?.data]);

  function toggleRow(row: { item_type: AdminLibraryItemType; id: number }) {
    const k = rowKey(row);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(rows.map(rowKey)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const selectedItems: AdminLibraryItemRef[] = useMemo(() => {
    return rows
      .filter((r) => selected.has(rowKey(r)))
      .map((r) => ({ type: r.item_type, id: r.id }));
  }, [rows, selected]);

  function isAllVisibleSelected() {
    return rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-text-primary">
          Library Administration
        </h1>
        <p className="text-sm text-text-muted">
          Cross-cuts the 10 lifecycle-managed tables (concept sets, cohort
          definitions, analyses). Super-admin only.
        </p>
      </header>

      <div className="flex gap-1 border-b border-border-default">
        {(["active", "trash"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={
              "px-4 py-2 text-sm capitalize " +
              (tab === t
                ? "border-b-2 border-accent-1 text-text-primary"
                : "text-text-muted hover:text-text-secondary")
            }
            onClick={() => {
              setTab(t);
              clearSelection();
            }}
          >
            {t === "active" ? "Active" : "Trash"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Type
          <select
            className="form-input"
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as AdminLibraryItemType | "")
            }
          >
            <option value="">All types</option>
            {ADMIN_LIBRARY_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {tab === "active" && (
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Status
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as AdminLibraryStatus | "all")
              }
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex-1 min-w-[200px] flex flex-col gap-1 text-xs text-text-secondary">
          Search
          <input
            type="search"
            className="form-input"
            placeholder="name or description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {selected.size > 0 && tab === "active" && (
          <div className="flex items-end gap-2">
            <Button
              variant="danger"
              onClick={() => setDeleteOpen(true)}
              icon={<Trash2 size={14} />}
            >
              Delete ({selected.size})
            </Button>
            <Button
              variant="primary"
              onClick={() => setReassignOpen(true)}
              icon={<UserCog size={14} />}
            >
              Reassign ({selected.size})
            </Button>
            <Button variant="ghost" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        )}
      </div>

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
        <div className="overflow-x-auto rounded-md border border-border-default">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-text-muted">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected()}
                    onChange={(e) =>
                      e.target.checked ? selectAllVisible() : clearSelection()
                    }
                    aria-label="Select all visible rows"
                  />
                </th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Updated</th>
                {tab === "trash" && (
                  <>
                    <th className="px-3 py-2 text-left">Deleted</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={tab === "trash" ? 8 : 6}
                    className="px-3 py-12 text-center text-text-muted"
                  >
                    No items match the current filters.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const k = rowKey(row);
                return (
                  <tr
                    key={k}
                    className="border-t border-border-default hover:bg-surface-2"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(k)}
                        onChange={() => toggleRow(row)}
                        aria-label={`Select ${row.item_type} ${row.id}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.item_type}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-text-primary">
                        {row.name ?? <em className="text-text-muted">—</em>}
                      </div>
                      {row.description && (
                        <div className="text-xs text-text-muted line-clamp-1">
                          {row.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.owner ? (
                        <span title={row.owner.email}>{row.owner.name}</span>
                      ) : (
                        <em className="text-text-muted">unowned</em>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-surface-3 px-2 py-0.5 text-xs">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-text-muted">
                      {row.updated_at?.slice(0, 10) ?? "—"}
                    </td>
                    {tab === "trash" && (
                      <>
                        <td className="px-3 py-2 text-xs text-text-muted">
                          {row.deleted_at?.slice(0, 10) ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<RotateCcw size={14} />}
                              disabled={restoreMut.isPending}
                              onClick={() =>
                                restoreMut.mutate([
                                  { type: row.item_type, id: row.id },
                                ])
                              }
                            >
                              Restore
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Zap size={14} />}
                              disabled={purgeMut.isPending}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Purge ${row.item_type} #${row.id} immediately? This cannot be undone.`,
                                  )
                                ) {
                                  purgeMut.mutate([
                                    { type: row.item_type, id: row.id },
                                  ]);
                                }
                              }}
                            >
                              Purge
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
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
    </div>
  );
}
