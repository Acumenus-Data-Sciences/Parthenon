// SP4 Phase D.2 / Polish 1 — MatchingConfigForm interaction smoke. Verifies
// form validation, comparator add/remove, and payload shape on submit. The
// CohortPicker is mocked to expose a programmatic Test-only "select" button
// per picker instance, since the real picker needs the cohort-search API.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

vi.mock("../components/CohortPicker", () => ({
  CohortPicker: ({
    value,
    onChange,
  }: {
    value: number | null;
    onChange: (id: number | null) => void;
  }) => (
    <div data-testid="cohort-picker" data-value={value ?? "null"}>
      <input
        data-testid="cohort-picker-input"
        type="number"
        min={1}
        defaultValue={value ?? ""}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(Number.isFinite(n) && n > 0 ? n : null);
        }}
      />
    </div>
  ),
}));

import { MatchingConfigForm } from "../components/MatchingConfigForm";

function renderWithQuery(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MatchingConfigForm", () => {
  it("submit is disabled when primary cohort is missing", () => {
    const onSubmit = vi.fn();
    renderWithQuery(<MatchingConfigForm sourceKey="EUNOMIA" onSubmit={onSubmit} />);
    const button = screen.getByText("Run matching").closest("button")!;
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit fires the correct payload when valid", () => {
    const onSubmit = vi.fn();
    renderWithQuery(
      <MatchingConfigForm
        sourceKey="EUNOMIA"
        defaultPrimaryCohortId={221}
        onSubmit={onSubmit}
      />,
    );
    // primary picker is index 0 (already populated via defaultPrimaryCohortId);
    // comparator picker is index 1 — set its value via the mocked input.
    const inputs = screen.getAllByTestId("cohort-picker-input");
    fireEvent.change(inputs[1], { target: { value: "222" } });
    fireEvent.click(screen.getByText("Run matching").closest("button")!);

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      source_key: "EUNOMIA",
      primary_cohort_id: 221,
      comparator_cohort_ids: [222],
      ratio: 1,
      match_sex: true,
      match_birth_year: true,
      max_year_difference: 1,
    });
  });

  it("rejects when primary == any comparator", () => {
    const onSubmit = vi.fn();
    renderWithQuery(
      <MatchingConfigForm sourceKey="EUNOMIA" defaultPrimaryCohortId={221} onSubmit={onSubmit} />,
    );
    const inputs = screen.getAllByTestId("cohort-picker-input");
    fireEvent.change(inputs[1], { target: { value: "221" } }); // same as primary
    const button = screen.getByText("Run matching").closest("button")!;
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("can add and remove comparator rows up to 10", () => {
    renderWithQuery(
      <MatchingConfigForm sourceKey="EUNOMIA" defaultPrimaryCohortId={1} onSubmit={vi.fn()} />,
    );
    // primary + 1 comparator = 2 picker instances
    expect(screen.getAllByTestId("cohort-picker")).toHaveLength(2);
    fireEvent.click(screen.getByText(/add/i));
    expect(screen.getAllByTestId("cohort-picker")).toHaveLength(3);
    const removeBtns = screen.getAllByLabelText("Remove comparator");
    fireEvent.click(removeBtns[0]);
    expect(screen.getAllByTestId("cohort-picker")).toHaveLength(2);
  });
});
