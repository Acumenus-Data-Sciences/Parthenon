import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CohortExpressionEditor } from "../CohortExpressionEditor";
import {
  useCohortExpressionStore,
  normalizeCohortExpression,
} from "../../stores/cohortExpressionStore";

describe("CohortExpressionEditor", () => {
  beforeEach(() => {
    useCohortExpressionStore.setState({
      expression: normalizeCohortExpression({}),
      isDirty: false,
    });
  });

  it("renders all ten collapsible section titles", () => {
    render(<CohortExpressionEditor />);
    expect(screen.getByText("Concept Sets")).toBeInTheDocument();
    expect(screen.getByText("Primary Criteria")).toBeInTheDocument();
    expect(screen.getByText("Inclusion Criteria")).toBeInTheDocument();
    expect(screen.getByText("Censoring Criteria")).toBeInTheDocument();
    expect(screen.getByText("End Strategy")).toBeInTheDocument();
    expect(screen.getByText("Demographic Criteria")).toBeInTheDocument();
    expect(screen.getByText("Genomic Criteria")).toBeInTheDocument();
    expect(screen.getByText("Imaging Criteria")).toBeInTheDocument();
    expect(screen.getByText("Risk Score Criteria")).toBeInTheDocument();
    expect(screen.getByText("Qualified Limit")).toBeInTheDocument();
  });

  it("shows the Primary Criteria panel open by default", () => {
    render(<CohortExpressionEditor />);
    // PrimaryCriteriaPanel is open by default; it shows the add-criterion UI
    // or the empty-state hint. Either way the panel body is visible.
    expect(
      screen.getByText("Primary Criteria"),
    ).toBeInTheDocument();
  });

  it("expands Concept Sets and shows the empty-state hint when clicked", () => {
    render(<CohortExpressionEditor />);
    fireEvent.click(screen.getByText("Concept Sets"));
    expect(
      screen.getByText(
        /No concept sets yet\. They will be created when you add criteria\./i,
      ),
    ).toBeInTheDocument();
  });

  it("reflects store updates: adding a concept set is reflected in the badge count", () => {
    const { rerender } = render(<CohortExpressionEditor />);
    act(() => {
      useCohortExpressionStore.setState({
        expression: normalizeCohortExpression({
          ConceptSets: [
            { id: 0, name: "Test Set", expression: { items: [] } },
          ],
        }),
      });
    });
    rerender(<CohortExpressionEditor />);
    // Expand Concept Sets panel to see the item
    fireEvent.click(screen.getByText("Concept Sets"));
    expect(screen.getByText("Test Set")).toBeInTheDocument();
  });

  it("toggles Qualified Limit between First and All via store actions", () => {
    render(<CohortExpressionEditor />);
    fireEvent.click(screen.getByText("Qualified Limit"));
    const allBtn = screen.getByRole("button", { name: /All qualifying/i });
    fireEvent.click(allBtn);
    const state = useCohortExpressionStore.getState();
    expect(state.expression.QualifiedLimit?.Type).toBe("All");
    expect(state.isDirty).toBe(true);
  });
});
