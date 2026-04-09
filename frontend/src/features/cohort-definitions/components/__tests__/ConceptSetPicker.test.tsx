import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConceptSetPicker } from "../ConceptSetPicker";
import { useCohortExpressionStore } from "../../stores/cohortExpressionStore";

function resetStore() {
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
}

describe("ConceptSetPicker", () => {
  beforeEach(() => {
    resetStore();
  });

  it("renders an empty select with the placeholder when no concept sets exist", () => {
    render(<ConceptSetPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByText("Select concept set")).toBeInTheDocument();
  });

  it("renders all existing concept sets as options", () => {
    useCohortExpressionStore.setState({
      expression: {
        ...useCohortExpressionStore.getState().expression,
        ConceptSets: [
          { id: 0, name: "Hypertension", expression: { items: [] } },
          {
            id: 1,
            name: "Diabetes",
            expression: {
              items: [
                { concept: { concept_id: 201820 } } as never,
              ],
            },
          },
        ],
      },
    });
    render(<ConceptSetPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByText(/Hypertension/)).toBeInTheDocument();
    expect(screen.getByText(/Diabetes/)).toBeInTheDocument();
  });

  it("invokes onChange when the select value changes", () => {
    useCohortExpressionStore.setState({
      expression: {
        ...useCohortExpressionStore.getState().expression,
        ConceptSets: [
          { id: 5, name: "Smoking", expression: { items: [] } },
        ],
      },
    });
    const onChange = vi.fn();
    render(<ConceptSetPicker value={null} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("toggles the New concept set form when the New button is clicked", () => {
    render(<ConceptSetPicker value={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("New"));
    expect(
      screen.getByPlaceholderText("Concept set name..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
  });

  it("creates a concept set and invokes onChange with its id when Create is pressed", () => {
    const onChange = vi.fn();
    render(<ConceptSetPicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText("New"));
    const input = screen.getByPlaceholderText("Concept set name...");
    fireEvent.change(input, { target: { value: "NewSet" } });
    fireEvent.click(screen.getByText("Create"));
    expect(onChange).toHaveBeenCalledWith(0);
    const state = useCohortExpressionStore.getState();
    expect(state.expression.ConceptSets).toHaveLength(1);
    expect(state.expression.ConceptSets[0].name).toBe("NewSet");
  });
});
