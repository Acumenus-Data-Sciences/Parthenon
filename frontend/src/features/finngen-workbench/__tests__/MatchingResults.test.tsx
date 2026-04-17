// SP4 Polish 5 — MatchingResults render smoke. Mocks useFinnGenRunStatus to
// feed a canned succeeded run carrying counts + waterfall + SMD diagnostics.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

vi.mock("../hooks/useFinnGenRunStatus", () => ({
  useFinnGenRunStatus: () => ({
    data: {
      id: "01MATCH",
      status: "succeeded",
      analysis_type: "cohort.match",
      source_key: "EUNOMIA",
      params: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:01Z",
      summary: {
        counts: [
          { cohortId: 221, cohortName: "All PDAC", cohortEntries: 361, cohortSubjects: 361 },
          { cohortId: 900, cohortName: "Matched cohort", cohortEntries: 146, cohortSubjects: 146 },
        ],
        waterfall: [
          { step: "primary_input", label: "Primary cohort #221", count: 361, cohort_id: 221 },
          { step: "comparator_input", label: "Comparator cohort #222", count: 146, cohort_id: 222 },
          { step: "matched_output", label: "Matched: Matched cohort", count: 146, cohort_id: 900, ratio: 1 },
        ],
        smd: [
          {
            covariate: "age_years",
            comparator_id: 222,
            mean_primary: 65.4,
            mean_comparator_pre: 70.1,
            mean_comparator_post: 65.9,
            smd_pre: 0.42,
            smd_post: 0.05,
            n_primary: 361,
            n_comparator_pre: 146,
            n_comparator_post: 146,
          },
          {
            covariate: "pct_female",
            comparator_id: 222,
            mean_primary: 0.52,
            mean_comparator_pre: 0.48,
            mean_comparator_post: 0.51,
            smd_pre: 0.08,
            smd_post: 0.02,
            n_primary: 361,
            n_comparator_pre: 146,
            n_comparator_post: 146,
          },
        ],
      },
    },
    isPending: false,
    isError: false,
  }),
}));

import { MatchingResults } from "../components/MatchingResults";

function renderWithQuery(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MatchingResults (Polish 5)", () => {
  it("renders the counts table", () => {
    renderWithQuery(<MatchingResults runId="01MATCH" />);
    expect(screen.getByText("All PDAC")).toBeDefined();
    expect(screen.getByText("Matched cohort")).toBeDefined();
  });

  it("renders the attrition waterfall with all steps", () => {
    renderWithQuery(<MatchingResults runId="01MATCH" />);
    expect(screen.getByText(/Attrition waterfall/i)).toBeDefined();
    expect(screen.getByText("Primary cohort #221")).toBeDefined();
    expect(screen.getByText("Comparator cohort #222")).toBeDefined();
    expect(screen.getByText("Matched: Matched cohort")).toBeDefined();
  });

  it("renders the SMD table with pre + post values", () => {
    renderWithQuery(<MatchingResults runId="01MATCH" />);
    expect(screen.getByText(/Covariate balance/i)).toBeDefined();
    expect(screen.getByText("age_years")).toBeDefined();
    expect(screen.getByText("pct_female")).toBeDefined();
    // Pre-match age SMD = 0.42 (red), post-match = 0.05 (green). Both appear
    // formatted to three decimals.
    expect(screen.getByText("0.420")).toBeDefined();
    expect(screen.getByText("0.050")).toBeDefined();
  });

  it("formats pct_female as a percentage", () => {
    renderWithQuery(<MatchingResults runId="01MATCH" />);
    expect(screen.getByText("52.0%")).toBeDefined();
    expect(screen.getByText("48.0%")).toBeDefined();
  });
});
