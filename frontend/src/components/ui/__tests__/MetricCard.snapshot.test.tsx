import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MetricCard } from "../MetricCard";

describe("MetricCard snapshots (dark clinical theme)", () => {
  it("renders a default card with value only", () => {
    const { container } = render(
      <MetricCard label="Patients" value={1234} />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="metric-card"
      >
        <div
          class="flex items-center justify-between"
        >
          <span
            class="metric-label"
          >
            Patients
          </span>
        </div>
        <div
          class="metric-value"
        >
          1234
        </div>
      </div>
    `);
    expect(container.innerHTML).toMatch(/metric-card/);
    expect(container.innerHTML).toMatch(/metric-value/);
  });

  it("renders a positive-trend variant", () => {
    const { container } = render(
      <MetricCard
        label="Coverage"
        value="85%"
        trend={{ value: "+5%", direction: "positive" }}
      />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="metric-card"
      >
        <div
          class="flex items-center justify-between"
        >
          <span
            class="metric-label"
          >
            Coverage
          </span>
        </div>
        <div
          class="metric-value"
        >
          85%
        </div>
        <div
          class="metric-trend positive"
        >
          +5%
        </div>
      </div>
    `);
    expect(container.innerHTML).toMatch(/metric-trend positive/);
  });

  it("renders a critical variant with negative trend", () => {
    const { container } = render(
      <MetricCard
        label="Errors"
        value={42}
        variant="critical"
        trend={{ value: "-3", direction: "negative" }}
      />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="metric-card critical"
      >
        <div
          class="flex items-center justify-between"
        >
          <span
            class="metric-label"
          >
            Errors
          </span>
        </div>
        <div
          class="metric-value"
        >
          42
        </div>
        <div
          class="metric-trend negative"
        >
          -3
        </div>
      </div>
    `);
    expect(container.innerHTML).toMatch(/metric-card critical/);
    expect(container.innerHTML).toMatch(/metric-trend negative/);
  });
});
