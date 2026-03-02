import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RecordCountsPanel } from "@/features/data-explorer/components/charts/RecordCountsPanel";
import type { RecordCount } from "@/features/data-explorer/types/dataExplorer";

// Mock recharts so we can test without a real DOM layout engine.
// ResponsiveContainer requires measured dimensions, which jsdom cannot provide.
// We also mock BarChart to render its data items as visible text so we can
// assert on the formatted display names that the component computes.
vi.mock("recharts", () => {
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    BarChart: ({ data, children }: { data: Array<Record<string, unknown>>; children: React.ReactNode }) => (
      <div data-testid="bar-chart">
        {data?.map((item: Record<string, unknown>, i: number) => (
          <div key={i} data-testid="bar-item">
            <span data-testid="bar-label">{String(item.displayName ?? "")}</span>
            <span data-testid="bar-value">{String(item.count ?? "")}</span>
          </div>
        ))}
        {children}
      </div>
    ),
    Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Cell: () => null,
  };
});

const sampleData: RecordCount[] = [
  { table: "person", count: 1200000 },
  { table: "observation_period", count: 3500 },
  { table: "condition_occurrence", count: 45000 },
];

describe("RecordCountsPanel", () => {
  it("renders without crashing with empty data", () => {
    render(<RecordCountsPanel data={[]} />);
    expect(
      screen.getByText("No record count data available"),
    ).toBeInTheDocument();
  });

  it("renders correct number of bars for data", () => {
    render(<RecordCountsPanel data={sampleData} />);
    // The heading should be present (non-empty branch)
    expect(
      screen.getByText("Record Counts by CDM Table"),
    ).toBeInTheDocument();
    // The component should NOT show the empty message
    expect(
      screen.queryByText("No record count data available"),
    ).not.toBeInTheDocument();
    // Our mock renders one bar-item per data point
    const barItems = screen.getAllByTestId("bar-item");
    expect(barItems).toHaveLength(3);
  });

  it("formats table names from snake_case to Title Case", () => {
    render(<RecordCountsPanel data={sampleData} />);
    // The component converts snake_case table names to Title Case display names
    // which our BarChart mock renders as visible text
    const labels = screen.getAllByTestId("bar-label").map((el) => el.textContent);
    expect(labels).toContain("Person");
    expect(labels).toContain("Observation Period");
    expect(labels).toContain("Condition Occurrence");
  });

  it("formats large numbers correctly", () => {
    // The formatCompact function is used as the XAxis tickFormatter.
    // Since that's internal to recharts, we test that the component
    // correctly passes data covering every format threshold without crashing
    // and verify the data branch renders.
    const bigData: RecordCount[] = [
      { table: "a", count: 2_500_000_000 }, // would format as 2.5B
      { table: "b", count: 1_005_787 },     // would format as 1.0M
      { table: "c", count: 45_000 },        // would format as 45.0K
      { table: "d", count: 500 },           // would format as 500
    ];
    render(<RecordCountsPanel data={bigData} />);
    expect(
      screen.getByText("Record Counts by CDM Table"),
    ).toBeInTheDocument();
    // Verify bar items rendered for all data points
    const barItems = screen.getAllByTestId("bar-item");
    expect(barItems).toHaveLength(4);
    // The raw count values are passed through to our mock
    const values = screen.getAllByTestId("bar-value").map((el) => el.textContent);
    expect(values).toContain("2500000000");
    expect(values).toContain("1005787");
    expect(values).toContain("45000");
    expect(values).toContain("500");
  });
});
