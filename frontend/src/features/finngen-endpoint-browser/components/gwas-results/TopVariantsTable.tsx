// Phase 16 Plan 05 Task 2 — TopVariantsTable (D-10, D-11).
//
// First Parthenon consumer of @tanstack/react-table v8.21.3 (RESEARCH
// Pitfall 8 — Vite 7 ESM resolution verified via `npx vite build`).
//
// 8 columns: chrom, pos, ref, alt, af, β, se, p-value. Click a column
// header to toggle asc→desc→off; initial sort is p_value ascending (most
// significant first). Click a row to trigger the VariantDrawer slideover.
//
// Rendering contract per D-12: p-value shows "<1e-300" when below
// floating-point floor, else scientific notation with 2 decimals; AF uses
// 4 decimals; β and SE use 3 decimals. All numeric cells tolerate null.
import { useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import type { TopVariantRow } from "../../api/gwas-results";

const columnHelper = createColumnHelper<TopVariantRow>();

const columns = [
  columnHelper.accessor("chrom", { header: "Chr" }),
  columnHelper.accessor("pos", {
    header: "Pos",
    cell: (i) => i.getValue().toLocaleString(),
  }),
  columnHelper.accessor("ref", { header: "Ref" }),
  columnHelper.accessor("alt", { header: "Alt" }),
  columnHelper.accessor("af", {
    header: "AF",
    cell: (i) => (i.getValue() ?? 0).toFixed(4),
  }),
  columnHelper.accessor("beta", {
    header: "\u03B2",
    cell: (i) => (i.getValue() ?? 0).toFixed(3),
  }),
  columnHelper.accessor("se", {
    header: "SE",
    cell: (i) => (i.getValue() ?? 0).toFixed(3),
  }),
  columnHelper.accessor("p_value", {
    header: "P",
    cell: (i) => {
      const v = i.getValue();
      return v < 1e-300 ? "<1e-300" : v.toExponential(2);
    },
  }),
];

export interface TopVariantsTableProps {
  rows: TopVariantRow[];
  onRowClick: (row: TopVariantRow) => void;
}

export function TopVariantsTable({
  rows,
  onRowClick,
}: TopVariantsTableProps): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "p_value", desc: false },
  ]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return (
      <div
        className="py-6 text-center text-sm text-text-muted"
        data-testid="top-variants-empty"
      >
        No variants to display
      </div>
    );
  }

  return (
    <table
      className="w-full text-xs"
      data-testid="top-variants-table"
    >
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => {
              const sortDir = h.column.getIsSorted();
              const indicator =
                sortDir === "asc" ? " \u25B2" : sortDir === "desc" ? " \u25BC" : "";
              return (
                <th
                  key={h.id}
                  scope="col"
                  className="cursor-pointer px-2 py-1 text-left font-medium text-text-muted hover:text-text-primary"
                  onClick={h.column.getToggleSortingHandler()}
                  data-testid={`top-variants-header-${h.id}`}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {indicator}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            className="cursor-pointer border-t border-border hover:bg-surface"
            onClick={() => onRowClick(row.original)}
            data-testid="top-variants-row"
          >
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id} className="px-2 py-1">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
