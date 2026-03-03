import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "../MetricCard";

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Total Patients" value={1005787} />);
    expect(screen.getByText("Total Patients")).toBeInTheDocument();
    expect(screen.getByText("1005787")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <MetricCard
        label="Conditions"
        value="14.7M"
        description="Across all patients"
      />,
    );
    expect(screen.getByText("Across all patients")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(
      <MetricCard label="Count" value={42} />,
    );
    expect(
      container.querySelector(".metric-description"),
    ).not.toBeInTheDocument();
  });

  it("renders trend indicator", () => {
    render(
      <MetricCard
        label="Coverage"
        value="85%"
        trend={{ value: "+5%", direction: "positive" }}
      />,
    );
    expect(screen.getByText("+5%")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <MetricCard
        label="Status"
        value="OK"
        icon={<span data-testid="metric-icon">*</span>}
      />,
    );
    expect(screen.getByTestId("metric-icon")).toBeInTheDocument();
  });
});
