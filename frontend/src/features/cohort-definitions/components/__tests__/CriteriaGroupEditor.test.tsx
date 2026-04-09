import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CriteriaGroupEditor } from "../CriteriaGroupEditor";
import type { CriteriaGroup } from "../../types/cohortExpression";

function emptyGroup(): CriteriaGroup {
  return { Type: "ALL", CriteriaList: [], Groups: [] };
}

describe("CriteriaGroupEditor", () => {
  it("renders the ALL/ANY/NONE group type selector", () => {
    render(<CriteriaGroupEditor group={emptyGroup()} onChange={vi.fn()} />);
    expect(screen.getByText("ALL")).toBeInTheDocument();
    expect(screen.getByText("ANY")).toBeInTheDocument();
    expect(screen.getByText("NONE")).toBeInTheDocument();
  });

  it("shows an empty-state message when no criteria or groups exist", () => {
    render(<CriteriaGroupEditor group={emptyGroup()} onChange={vi.fn()} />);
    expect(
      screen.getByText(/No criteria in this group/i),
    ).toBeInTheDocument();
  });

  it("invokes onChange with the new group Type when ANY is clicked", () => {
    const onChange = vi.fn();
    render(<CriteriaGroupEditor group={emptyGroup()} onChange={onChange} />);
    fireEvent.click(screen.getByText("ANY"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ Type: "ANY" }),
    );
  });

  it("renders the 'Add Nested Group' button at depth 0", () => {
    render(<CriteriaGroupEditor group={emptyGroup()} onChange={vi.fn()} />);
    expect(screen.getByText("Add Nested Group")).toBeInTheDocument();
  });

  it("calls onChange with an appended nested group when the button is clicked", () => {
    const onChange = vi.fn();
    render(<CriteriaGroupEditor group={emptyGroup()} onChange={onChange} />);
    fireEvent.click(screen.getByText("Add Nested Group"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        Groups: expect.arrayContaining([
          expect.objectContaining({ Type: "ALL" }),
        ]),
      }),
    );
  });

  it("does not render Add Nested Group at depth 2 (max nesting)", () => {
    render(
      <CriteriaGroupEditor group={emptyGroup()} onChange={vi.fn()} depth={2} />,
    );
    expect(screen.queryByText("Add Nested Group")).not.toBeInTheDocument();
  });
});
