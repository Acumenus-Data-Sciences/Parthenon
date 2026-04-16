// SP4 Phase D.2 — MatchingConfigForm interaction smoke. Verifies form
// validation, comparator add/remove, payload shape on submit.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchingConfigForm } from "../components/MatchingConfigForm";

describe("MatchingConfigForm", () => {
  it("submit is disabled when primary cohort is missing", () => {
    const onSubmit = vi.fn();
    render(<MatchingConfigForm sourceKey="EUNOMIA" onSubmit={onSubmit} />);
    const button = screen.getByText("Run matching").closest("button")!;
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit fires the correct payload when valid", () => {
    const onSubmit = vi.fn();
    render(
      <MatchingConfigForm
        sourceKey="EUNOMIA"
        defaultPrimaryCohortId={221}
        cohortNames={{ 221: "All PDAC" }}
        onSubmit={onSubmit}
      />,
    );
    // Fill the (single) comparator input.
    const inputs = screen.getAllByPlaceholderText("cohort id");
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
    render(<MatchingConfigForm sourceKey="EUNOMIA" defaultPrimaryCohortId={221} onSubmit={onSubmit} />);
    const inputs = screen.getAllByPlaceholderText("cohort id");
    fireEvent.change(inputs[1], { target: { value: "221" } }); // same as primary
    const button = screen.getByText("Run matching").closest("button")!;
    expect(button.hasAttribute("disabled")).toBe(true);
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("can add and remove comparator rows up to 10", () => {
    render(<MatchingConfigForm sourceKey="EUNOMIA" defaultPrimaryCohortId={1} onSubmit={vi.fn()} />);
    expect(screen.getAllByPlaceholderText("cohort id")).toHaveLength(2); // primary + 1 comparator
    fireEvent.click(screen.getByText(/add/i));
    expect(screen.getAllByPlaceholderText("cohort id")).toHaveLength(3);
    const removeBtns = screen.getAllByLabelText("Remove comparator");
    fireEvent.click(removeBtns[0]);
    expect(screen.getAllByPlaceholderText("cohort id")).toHaveLength(2);
  });
});
