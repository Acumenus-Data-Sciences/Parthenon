import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DomainCriteriaSelector } from "../DomainCriteriaSelector";
import { useCohortExpressionStore } from "../../stores/cohortExpressionStore";

describe("DomainCriteriaSelector", () => {
  beforeEach(() => {
    // Reset zustand store so ConceptSetPicker starts empty
    useCohortExpressionStore.setState({
      expression: {
        ConceptSets: [],
        PrimaryCriteria: {
          CriteriaList: [],
          ObservationWindow: { PriorDays: 0, PostDays: 0 },
        },
        QualifiedLimit: { Type: "First" },
        ExpressionLimit: { Type: "First" },
        CollapseSettings: { CollapseType: "ERA", EraPad: 0 },
      },
      isDirty: false,
    });
  });

  it("renders the 'Add Criterion' header and all 7 domain buttons", () => {
    render(<DomainCriteriaSelector onAdd={vi.fn()} />);
    expect(screen.getByText("Add Criterion")).toBeInTheDocument();
    expect(screen.getByText("Condition")).toBeInTheDocument();
    expect(screen.getByText("Drug")).toBeInTheDocument();
    expect(screen.getByText("Procedure")).toBeInTheDocument();
    expect(screen.getByText("Measurement")).toBeInTheDocument();
    expect(screen.getByText("Observation")).toBeInTheDocument();
    expect(screen.getByText("Visit")).toBeInTheDocument();
    expect(screen.getByText("Death")).toBeInTheDocument();
  });

  it("does not show the Concept Set picker until a domain is selected", () => {
    render(<DomainCriteriaSelector onAdd={vi.fn()} />);
    expect(screen.queryByText("Concept Set")).not.toBeInTheDocument();
  });

  it("reveals the Concept Set picker after clicking a domain button", () => {
    render(<DomainCriteriaSelector onAdd={vi.fn()} />);
    fireEvent.click(screen.getByText("Condition"));
    expect(screen.getByText("Concept Set")).toBeInTheDocument();
    expect(screen.getByText("First occurrence only")).toBeInTheDocument();
  });

  it("invokes onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<DomainCriteriaSelector onAdd={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Drug"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables the Add Criterion button until a concept set is chosen", () => {
    render(<DomainCriteriaSelector onAdd={vi.fn()} />);
    fireEvent.click(screen.getByText("Observation"));
    const addBtn = screen.getAllByRole("button", { name: /Add Criterion/i })[0];
    expect(addBtn).toBeDisabled();
  });
});
