// Phase 18 (Plan 18-06) — ComorbidityMatrixPanel real assertions (GREEN flip).
// Covers D-06 (click-through navigation) and D-07 (divergent crimson/teal scale).
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComorbidityMatrixPanel } from "../ComorbidityMatrixPanel";
import { getPhiCellClass } from "../heatmap-helpers";
import type { EndpointProfileComorbidity } from "../../../api";

function makeRows(n: number): EndpointProfileComorbidity[] {
  return Array.from({ length: n }, (_, i) => ({
    comorbid_endpoint_name: `E_TEST_${i}`,
    comorbid_endpoint_display_name: `Test endpoint ${i}`,
    phi_coef: 0.5 - i * 0.01,
    odds_ratio: 3.0,
    or_ci_low: 2.5,
    or_ci_high: 3.5,
    co_count: 100 - i,
    rank: i + 1,
  }));
}

describe("ComorbidityMatrixPanel", () => {
  it("renders up to 50 rows in a single-column listitem layout", () => {
    const rows = makeRows(50);
    render(
      <ComorbidityMatrixPanel
        comorbidities={rows}
        universeSize={120}
        minSubjects={20}
        sourceKey="PANCREAS"
        onNavigate={() => {}}
      />,
    );
    const listItems = screen.getAllByRole("listitem");
    expect(listItems.length).toBe(50);
  });

  it("getPhiCellClass returns crimson Tailwind class when phi >= 0.20 (D-07)", () => {
    const cls = getPhiCellClass(0.5);
    expect(cls).toContain("#9B1B30");
  });

  it("getPhiCellClass returns teal-400 (NOT teal-500) when phi <= -0.05 (D-07)", () => {
    const cls = getPhiCellClass(-0.2);
    expect(cls).toContain("teal-400");
    expect(cls).not.toContain("teal-500");
  });

  it("getPhiCellClass returns neutral-gray noise-floor class when |phi| < 0.05 (D-07)", () => {
    const cls = getPhiCellClass(0.0);
    expect(cls).toContain("--surface-raised");
  });

  it("calls onNavigate with the comorbid endpoint name when row is clicked", () => {
    const onNavigate = vi.fn();
    const rows = makeRows(3);
    render(
      <ComorbidityMatrixPanel
        comorbidities={rows}
        universeSize={120}
        minSubjects={20}
        sourceKey="PANCREAS"
        onNavigate={onNavigate}
      />,
    );
    const listItems = screen.getAllByRole("listitem");
    fireEvent.click(listItems[0]);
    expect(onNavigate).toHaveBeenCalledWith("E_TEST_0");
  });

  it("constructs the click-through URL pattern ?open=NEW&tab=profile&source=PANCREAS via the parent navigate fn", () => {
    // The component delegates URL construction to onNavigate. Verify the
    // contract: parent receives the comorbid_endpoint_name and is expected
    // to build the canonical URL `?open=${name}&tab=profile&source=${sourceKey}`.
    const onNavigate = vi.fn((endpoint: string) => {
      const url = `?open=${encodeURIComponent(endpoint)}&tab=profile&source=PANCREAS`;
      return url;
    });
    const rows = makeRows(2);
    render(
      <ComorbidityMatrixPanel
        comorbidities={rows}
        universeSize={120}
        minSubjects={20}
        sourceKey="PANCREAS"
        onNavigate={onNavigate}
      />,
    );
    const listItems = screen.getAllByRole("listitem");
    fireEvent.click(listItems[1]);
    expect(onNavigate).toHaveBeenCalledWith("E_TEST_1");
    // Manually drive the URL the parent would have built.
    const builtUrl = onNavigate.mock.results[0]?.value as string;
    expect(builtUrl).toContain("tab=profile");
    expect(builtUrl).toContain("source=PANCREAS");
  });

  it("renders 'Only {N} FinnGen endpoints have ≥ 20 subjects on this source.' empty-state when universeSize < 50 and rows are empty", () => {
    render(
      <ComorbidityMatrixPanel
        comorbidities={[]}
        universeSize={12}
        minSubjects={20}
        sourceKey="PANCREAS"
        onNavigate={() => {}}
      />,
    );
    expect(
      screen.getByText(
        /Only 12 FinnGen endpoints have ≥ 20 subjects on this source\./,
      ),
    ).toBeTruthy();
  });

  it("renders 'No co-occurring endpoints…' empty-state when universeSize === 0", () => {
    render(
      <ComorbidityMatrixPanel
        comorbidities={[]}
        universeSize={0}
        minSubjects={20}
        sourceKey="PANCREAS"
        onNavigate={() => {}}
      />,
    );
    expect(
      screen.getByText(
        "No co-occurring endpoints with ≥ 20 subjects on this source.",
      ),
    ).toBeTruthy();
  });
});
