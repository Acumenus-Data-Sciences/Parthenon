// Phase 16 Plan 05 Task 2 — TopVariantsTable tests.
//
// Covers: 8 headers, initial ascending sort on p_value, sort toggle via
// header click, onRowClick dispatches full TopVariantRow, empty state,
// and numeric formatting (p-value floor + locale commas).
//
// @tanstack/react-table v8.21.3 first-consumer smoke — if ESM resolution
// breaks under Vite 7 + Vitest, these tests will refuse to import.
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopVariantsTable } from "../TopVariantsTable";
import type { TopVariantRow } from "../../../api/gwas-results";

function variant(partial: Partial<TopVariantRow>): TopVariantRow {
  return {
    chrom: "17",
    pos: 43_000_000,
    ref: "A",
    alt: "T",
    af: 0.12,
    beta: 0.05,
    se: 0.01,
    p_value: 1e-10,
    snp_id: "rs123",
    gwas_run_id: "01JABCDEFGHIJKLMNOPQRSTUVW",
    ...partial,
  };
}

describe("TopVariantsTable", () => {
  it("renders 8 column headers: Chr, Pos, Ref, Alt, AF, β, SE, P", () => {
    render(<TopVariantsTable rows={[variant({})]} onRowClick={() => undefined} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(8);
    expect(headers[0]).toHaveTextContent("Chr");
    expect(headers[1]).toHaveTextContent("Pos");
    expect(headers[2]).toHaveTextContent("Ref");
    expect(headers[3]).toHaveTextContent("Alt");
    expect(headers[4]).toHaveTextContent("AF");
    expect(headers[5]).toHaveTextContent("\u03B2");
    expect(headers[6]).toHaveTextContent("SE");
    expect(headers[7]).toHaveTextContent("P");
  });

  it("renders all 50 rows when supplied", () => {
    const rows: TopVariantRow[] = Array.from({ length: 50 }, (_, i) =>
      variant({ pos: 43_000_000 + i, p_value: (i + 1) * 1e-15 }),
    );
    render(<TopVariantsTable rows={rows} onRowClick={() => undefined} />);
    expect(screen.getAllByTestId("top-variants-row")).toHaveLength(50);
  });

  it("initially sorts ascending by p_value (most significant first)", () => {
    const rows: TopVariantRow[] = [
      variant({ pos: 100, p_value: 1e-8 }),
      variant({ pos: 200, p_value: 1e-12 }),
      variant({ pos: 300, p_value: 1e-4 }),
    ];
    render(<TopVariantsTable rows={rows} onRowClick={() => undefined} />);
    const tbody = screen.getByTestId("top-variants-table").querySelector("tbody");
    const firstRow = tbody?.querySelectorAll("tr")[0];
    // Most significant (smallest p) = pos 200 after sorting
    expect(firstRow).toHaveTextContent("200");
  });

  it("cycles sort state on header clicks (default TanStack v8 order: none → desc → asc)", () => {
    const rows: TopVariantRow[] = [variant({ pos: 100 })];
    render(<TopVariantsTable rows={rows} onRowClick={() => undefined} />);
    const header = screen.getByTestId("top-variants-header-p_value");
    // Initial state is asc (up arrow) because we seeded { id: "p_value", desc: false }
    expect(header.textContent).toMatch(/\u25B2/);
    // Click 1 cycles out of asc → cleared (TanStack v8 default cycle from asc
    // is "remove sort" when enableSortingRemoval is on)
    fireEvent.click(header);
    expect(header.textContent).not.toMatch(/\u25B2|\u25BC/);
    // Click 2 → desc (down arrow)
    fireEvent.click(header);
    expect(header.textContent).toMatch(/\u25BC/);
    // Click 3 → asc (up arrow)
    fireEvent.click(header);
    expect(header.textContent).toMatch(/\u25B2/);
  });

  it("applies a sort arrow when an unsorted header is first clicked", () => {
    const rows: TopVariantRow[] = [variant({ pos: 100 })];
    render(<TopVariantsTable rows={rows} onRowClick={() => undefined} />);
    const chrHeader = screen.getByTestId("top-variants-header-chrom");
    expect(chrHeader.textContent).not.toMatch(/\u25B2|\u25BC/);
    fireEvent.click(chrHeader);
    // Sort indicator appears (direction depends on TanStack's default — we
    // assert only that a sort has been applied to this column).
    expect(chrHeader.textContent).toMatch(/\u25B2|\u25BC/);
  });

  it("invokes onRowClick with the full TopVariantRow when a row is clicked", () => {
    const onRowClick = vi.fn();
    const row = variant({ pos: 42, snp_id: "rs999" });
    render(<TopVariantsTable rows={[row]} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByTestId("top-variants-row"));
    expect(onRowClick).toHaveBeenCalledWith(row);
  });

  it("renders the empty state when rows is empty", () => {
    render(<TopVariantsTable rows={[]} onRowClick={() => undefined} />);
    expect(screen.getByTestId("top-variants-empty")).toHaveTextContent(
      "No variants to display",
    );
  });

  it("clamps p-values below 1e-300 to the <1e-300 sentinel", () => {
    const rows: TopVariantRow[] = [variant({ pos: 100, p_value: 1e-400 })];
    render(<TopVariantsTable rows={rows} onRowClick={() => undefined} />);
    const row = screen.getByTestId("top-variants-row");
    expect(within(row).getByText("<1e-300")).toBeInTheDocument();
  });

  it("renders locale-formatted pos values", () => {
    const rows: TopVariantRow[] = [variant({ pos: 43_500_000 })];
    render(<TopVariantsTable rows={rows} onRowClick={() => undefined} />);
    const row = screen.getByTestId("top-variants-row");
    expect(within(row).getByText("43,500,000")).toBeInTheDocument();
  });
});
