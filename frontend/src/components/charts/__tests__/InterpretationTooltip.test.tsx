import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InterpretationTooltip } from "../InterpretationTooltip";

describe("InterpretationTooltip", () => {
  const defaultProps = {
    metric: "Hazard Ratio",
    plain: "How much more likely the outcome is with the treatment.",
    technical: "Exp(beta) from Cox proportional hazards model.",
  };

  it("renders trigger button", () => {
    render(<InterpretationTooltip {...defaultProps} />);
    expect(screen.getByTestId("interpretation-tooltip-trigger")).toBeInTheDocument();
  });

  it("does not show popover by default", () => {
    render(<InterpretationTooltip {...defaultProps} />);
    expect(screen.queryByTestId("interpretation-tooltip-popover")).not.toBeInTheDocument();
  });

  it("shows popover on click", () => {
    render(<InterpretationTooltip {...defaultProps} />);
    fireEvent.click(screen.getByTestId("interpretation-tooltip-trigger"));
    expect(screen.getByTestId("interpretation-tooltip-popover")).toBeInTheDocument();
    expect(screen.getByText("Hazard Ratio")).toBeInTheDocument();
    expect(screen.getByText(defaultProps.plain)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.technical)).toBeInTheDocument();
  });

  it("toggles popover on subsequent clicks", () => {
    render(<InterpretationTooltip {...defaultProps} />);
    const trigger = screen.getByTestId("interpretation-tooltip-trigger");

    fireEvent.click(trigger);
    expect(screen.getByTestId("interpretation-tooltip-popover")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId("interpretation-tooltip-popover")).not.toBeInTheDocument();
  });

  it("has accessible aria-label on trigger", () => {
    render(<InterpretationTooltip {...defaultProps} />);
    const trigger = screen.getByTestId("interpretation-tooltip-trigger");
    expect(trigger.getAttribute("aria-label")).toBe("What does Hazard Ratio mean?");
  });
});
