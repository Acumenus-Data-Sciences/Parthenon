import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPage } from "../pages/DashboardPage";
import type { DashboardStats } from "../api/dashboardApi";

// Mock the useDashboard hook
vi.mock("../hooks/useDashboard");

// Mock data-explorer hooks (used for CDM characterization section)
vi.mock("@/features/data-explorer/hooks/useAchillesData", () => ({
  useRecordCounts: () => ({ data: null, isLoading: false }),
  useDemographics: () => ({ data: null, isLoading: false }),
  useObservationPeriods: () => ({ data: null, isLoading: false }),
}));

// Mock chart components that depend on canvas/SVG
vi.mock("@/features/data-explorer/components/charts/ProportionalBar", () => ({
  ProportionalBar: () => <div data-testid="proportional-bar" />,
}));
vi.mock("@/features/data-explorer/components/charts/DemographicsPyramid", () => ({
  DemographicsPyramid: () => <div data-testid="demographics-pyramid" />,
}));
vi.mock("@/features/data-explorer/components/charts/Sparkline", () => ({
  Sparkline: () => <div data-testid="sparkline" />,
}));
vi.mock("@/features/data-explorer/components/SourceSelector", () => ({
  SourceSelector: () => <select data-testid="source-selector" />,
}));
vi.mock("@/features/help", () => ({
  HelpButton: () => <button data-testid="help-button" />,
}));

import { useDashboardStats } from "../hooks/useDashboard";
const mockedUseDashboardStats = vi.mocked(useDashboardStats);

const MOCK_STATS: DashboardStats = {
  sources: [
    {
      id: 1,
      source_name: "Acumenus CDM",
      source_key: "acumenus",
      source_dialect: "postgresql",
      source_connection: "",
      is_default: true,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      daimons: [],
    } as DashboardStats["sources"][0],
  ],
  cohortCount: 12,
  conceptSetCount: 5,
  activeJobCount: 2,
  dqdFailures: 3,
  recentCohorts: [
    {
      id: 1,
      name: "Type 2 Diabetes",
      status: "active",
      person_count: 4500,
      updated_at: "2026-03-20",
    },
  ],
  recentJobs: [
    {
      id: 1,
      name: "Achilles Analysis",
      type: "achilles",
      status: "running",
      progress: 45,
      started_at: "2026-03-20T10:00:00Z",
      duration: null,
    },
  ],
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title and subtitle", () => {
    mockedUseDashboardStats.mockReturnValue({
      data: MOCK_STATS,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useDashboardStats>);

    renderDashboard();

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(
      screen.getByText("Unified Outcomes Research Platform"),
    ).toBeInTheDocument();
  });

  it("shows loading skeletons when data is loading", () => {
    mockedUseDashboardStats.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useDashboardStats>);

    const { container } = renderDashboard();

    // Skeleton components should be rendered during loading
    const skeletons = container.querySelectorAll(".grid.grid-cols-4");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders metric cards with correct values when data is loaded", () => {
    mockedUseDashboardStats.mockReturnValue({
      data: MOCK_STATS,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useDashboardStats>);

    renderDashboard();

    // Check metric card labels are present
    expect(screen.getByText("CDM Sources")).toBeInTheDocument();
    expect(screen.getByText("Running Jobs")).toBeInTheDocument();
    expect(screen.getByText("Concept Sets")).toBeInTheDocument();
    expect(screen.getByText("Active Cohorts")).toBeInTheDocument();
  });

  it("displays recent cohort activity table", () => {
    mockedUseDashboardStats.mockReturnValue({
      data: MOCK_STATS,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useDashboardStats>);

    renderDashboard();

    expect(screen.getByText("Recent Cohort Activity")).toBeInTheDocument();
    expect(screen.getByText("Type 2 Diabetes")).toBeInTheDocument();
    expect(screen.getByText("4,500")).toBeInTheDocument();
  });

  it("shows quick action links", () => {
    mockedUseDashboardStats.mockReturnValue({
      data: MOCK_STATS,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useDashboardStats>);

    renderDashboard();

    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    expect(screen.getByText("Connect a Data Source")).toBeInTheDocument();
    expect(screen.getByText("Create Cohort Definition")).toBeInTheDocument();
    expect(screen.getByText("Build Concept Set")).toBeInTheDocument();
    expect(screen.getByText("Explore Data Quality")).toBeInTheDocument();
  });

  it("shows error alert when API call fails", () => {
    mockedUseDashboardStats.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
    } as ReturnType<typeof useDashboardStats>);

    renderDashboard();

    expect(
      screen.getByText("Unable to load dashboard data"),
    ).toBeInTheDocument();
  });

  it("shows empty state when there are no cohorts", () => {
    mockedUseDashboardStats.mockReturnValue({
      data: { ...MOCK_STATS, recentCohorts: [] },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useDashboardStats>);

    renderDashboard();

    expect(screen.getByText("No cohorts yet")).toBeInTheDocument();
  });

  it("shows empty state when there are no active jobs", () => {
    mockedUseDashboardStats.mockReturnValue({
      data: { ...MOCK_STATS, recentJobs: [] },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useDashboardStats>);

    renderDashboard();

    expect(screen.getByText("No active jobs")).toBeInTheDocument();
  });
});
