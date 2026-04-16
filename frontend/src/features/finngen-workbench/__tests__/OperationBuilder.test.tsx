// SP4 Phase B.4 — OperationBuilder render + interaction smoke. We exercise
// the click-based controls (add cohort, add op, cycle op kind, remove) and
// assert validation/expression display reflects the live tree state.
//
// usePreviewCounts uses TanStack Query useMutation unconditionally, so every
// render needs a QueryClientProvider — even when sourceKey is omitted (the
// hook still runs). The renderWithQuery helper wraps consistently.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { OperationBuilder } from "../components/OperationBuilder";
import { makeCohort, makeOp } from "../lib/operationTree";

function renderWithQuery(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("OperationBuilder", () => {
  it("renders empty state with cohort + op buttons", () => {
    const onChange = vi.fn();
    renderWithQuery(<OperationBuilder tree={null} onChange={onChange} />);
    expect(screen.getByText(/Empty operation tree/i)).toBeDefined();
    // Polish 1 — empty state shows a "+ cohort" button that opens the picker
    // on click; raw number input was removed in favor of the typeahead.
    expect(screen.getByText("cohort")).toBeDefined();
    expect(screen.getByText("UNION")).toBeDefined();
    expect(screen.getByText("INTERSECT")).toBeDefined();
    expect(screen.getByText("MINUS")).toBeDefined();
  });

  it("creates a UNION root when the empty-state UNION button is clicked", () => {
    const onChange = vi.fn();
    renderWithQuery(<OperationBuilder tree={null} onChange={onChange} />);
    fireEvent.click(screen.getByText("UNION"));
    expect(onChange).toHaveBeenCalledOnce();
    const arg = onChange.mock.calls[0][0];
    expect(arg.kind).toBe("op");
    expect(arg.op).toBe("UNION");
    expect(arg.children).toEqual([]);
  });

  it("renders a non-empty tree with cohort chips", () => {
    const tree = makeOp("UNION", [makeCohort(221), makeCohort(222)]);
    renderWithQuery(<OperationBuilder tree={tree} onChange={vi.fn()} cohortNames={{ 221: "All PDAC" }} />);
    expect(screen.getByText("All PDAC")).toBeDefined();
    expect(screen.getByText("#221")).toBeDefined();
    expect(screen.getByText("#222")).toBeDefined();
  });

  it("removing a cohort chip calls onChange with the chip stripped", () => {
    const c1 = makeCohort(221);
    const c2 = makeCohort(222);
    const tree = makeOp("UNION", [c1, c2]);
    const onChange = vi.fn();
    renderWithQuery(<OperationBuilder tree={tree} onChange={onChange} />);
    const removeBtns = screen.getAllByLabelText("Remove cohort");
    fireEvent.click(removeBtns[0]);
    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0];
    expect(next.children).toHaveLength(1);
    expect(next.children[0].cohort_id).toBe(222);
  });

  it("cycles op kind UNION → INTERSECT → MINUS → UNION on repeated clicks", () => {
    const tree = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
    let current = tree;
    renderWithQuery(
      <OperationBuilder tree={current} onChange={(t) => { current = t!; }} />,
    );
    fireEvent.click(screen.getByText("UNION").closest("button")!);
    expect(current.kind).toBe("op");
    expect(current.op).toBe("INTERSECT");
  });

  it("expression disclosure renders compiled string when valid", () => {
    const tree = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
    renderWithQuery(<OperationBuilder tree={tree} onChange={vi.fn()} />);
    // Polish 4 — the compiled string is now also shown inline above the
    // disclosure (always-visible). After clicking "Show as expression", it
    // appears in TWO places: the inline live preview AND the disclosure pane.
    fireEvent.click(screen.getByText(/Show as expression/i));
    expect(screen.getAllByText("1 UNION 2").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the live expression preview when a tree is present", () => {
    const tree = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
    renderWithQuery(<OperationBuilder tree={tree} onChange={vi.fn()} />);
    expect(screen.getByText(/Expression:/i)).toBeDefined();
    // The live preview reads "1 UNION 2" before the disclosure is opened.
    expect(screen.getByText("1 UNION 2")).toBeDefined();
  });

  it("expression disclosure flags invalid trees", () => {
    const tree = makeOp("UNION", [makeCohort(1)]); // op with one child
    renderWithQuery(<OperationBuilder tree={tree} onChange={vi.fn()} />);
    expect(screen.getByText(/1 validation error/)).toBeDefined();
  });

  it("Preview button is hidden when sourceKey is omitted", () => {
    const tree = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
    renderWithQuery(<OperationBuilder tree={tree} onChange={vi.fn()} />);
    expect(screen.queryByText(/Preview row count/i)).toBeNull();
  });

  it("Preview button shows when sourceKey is provided", () => {
    const tree = makeOp("UNION", [makeCohort(1), makeCohort(2)]);
    renderWithQuery(<OperationBuilder tree={tree} onChange={vi.fn()} sourceKey="PANCREAS" />);
    expect(screen.getByText(/Preview row count/i)).toBeDefined();
  });
});
