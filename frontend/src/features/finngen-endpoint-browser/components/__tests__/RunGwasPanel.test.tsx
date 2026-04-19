// Phase 15 Plan 15-06 — RunGwasPanel tests (UI-SPEC §Layout Section 3).
//
// The panel wraps three query/mutation hooks:
//   - useDispatchGwas         (mutation)
//   - useEligibleControlCohorts (query, enabled by sourceKey)
//   - useCovariateSets         (query, eager)
//
// Tests stub the hook modules to keep the panel isolated from TanStack Query
// internals and the apiClient.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type {
  CovariateSetSummary,
  EligibleControlCohort,
  EndpointDetailWithPhase15,
  EndpointGenerationRun,
  GwasDispatchRefusal,
} from "../../api";

// ── Hook stubs ──────────────────────────────────────────────────────────────
const mutateMock = vi.fn();
const dispatchState: {
  isPending: boolean;
  error: GwasDispatchRefusal | Error | null;
} = {
  isPending: false,
  error: null,
};

vi.mock("../../hooks/useDispatchGwas", () => ({
  useDispatchGwas: () => ({
    mutate: mutateMock,
    isPending: dispatchState.isPending,
    error: dispatchState.error,
  }),
}));

const eligibleControlsData: EligibleControlCohort[] = [
  {
    cohort_definition_id: 221,
    name: "Healthy controls",
    subject_count: 9421,
    last_generated_at: new Date().toISOString(),
  },
];

vi.mock("../../hooks/useEligibleControlCohorts", () => ({
  useEligibleControlCohorts: () => ({
    data: eligibleControlsData,
    isLoading: false,
  }),
}));

const covariateSetsData: CovariateSetSummary[] = [
  {
    id: 1,
    name: "Default: age + sex + 10 PCs",
    is_default: true,
    description: null,
  },
];

vi.mock("../../hooks/useCovariateSets", () => ({
  useCovariateSets: () => ({
    data: covariateSetsData,
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────────────
import { RunGwasPanel } from "../RunGwasPanel";

const endpoint = {
  id: 1,
  name: "E4_DM2",
  longname: "Type 2 diabetes",
  description: null,
  tags: [],
  release: null,
  coverage_bucket: "FULLY_MAPPED",
  coverage_profile: "universal",
  coverage: null,
  level: null,
  sex_restriction: null,
  include_endpoints: null,
  pre_conditions: null,
  conditions: null,
  source_codes: null,
  resolved_concepts: {
    condition_count: 0,
    drug_count: 0,
    source_concept_count: 0,
    truncated: false,
  },
  generations: [],
  created_at: null,
  updated_at: null,
  gwas_ready_sources: ["PANCREAS"],
} satisfies EndpointDetailWithPhase15;

const generationRun: EndpointGenerationRun = {
  run_id: "01J0",
  source_key: "PANCREAS",
  status: "succeeded",
  subject_count: 312,
  created_at: new Date().toISOString(),
  finished_at: new Date().toISOString(),
};

function wrap(children: React.ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("RunGwasPanel", () => {
  beforeEach(() => {
    mutateMock.mockReset();
    dispatchState.isPending = false;
    dispatchState.error = null;
  });

  it("renders collapsed by default with 'Dispatch a new GWAS run…' trigger", () => {
    render(wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />));
    expect(screen.getByText(/Dispatch a new GWAS run/)).toBeInTheDocument();
    // Header eyebrow renders.
    expect(screen.getByText("Run GWAS")).toBeInTheDocument();
  });

  it("shows disabled helper when no gwas_ready_sources", () => {
    const none = { ...endpoint, gwas_ready_sources: [] };
    render(wrap(<RunGwasPanel endpoint={none} generationRuns={[]} />));
    const trigger = screen.getByRole("button", {
      name: /Generate this endpoint first/,
    });
    expect(trigger).toBeDisabled();
  });

  it("expands on trigger click and reveals pickers + CTA", () => {
    render(wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />));
    fireEvent.click(screen.getByRole("button", { name: /Dispatch a new GWAS run/ }));
    // Source picker, control picker, CTA.
    expect(screen.getByLabelText("Source")).toBeInTheDocument();
    expect(screen.getByLabelText("Control cohort")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run GWAS" })).toBeInTheDocument();
  });

  it("Run GWAS CTA is disabled until source + control are chosen", () => {
    render(wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />));
    fireEvent.click(screen.getByRole("button", { name: /Dispatch a new GWAS run/ }));
    const cta = screen.getByRole("button", { name: "Run GWAS" });
    expect(cta).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "PANCREAS" },
    });
    // Still disabled — no control cohort.
    expect(cta).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Control cohort"), {
      target: { value: "221" },
    });
    expect(cta).toBeEnabled();
  });

  it("dispatches with the resolved covariate_set_id on CTA click", () => {
    render(wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />));
    fireEvent.click(screen.getByRole("button", { name: /Dispatch a new GWAS run/ }));
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "PANCREAS" },
    });
    fireEvent.change(screen.getByLabelText("Control cohort"), {
      target: { value: "221" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run GWAS" }));
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [payload] = mutateMock.mock.calls[0];
    expect(payload).toMatchObject({
      source_key: "PANCREAS",
      control_cohort_id: 221,
      covariate_set_id: 1,
      overwrite: false,
    });
  });

  it("renders a role=alert banner with mapped copy on refusal", () => {
    dispatchState.error = {
      message: "run_in_flight",
      error_code: "run_in_flight",
      existing_run_id: "01JEXIST",
    } satisfies GwasDispatchRefusal;
    render(wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />));
    fireEvent.click(screen.getByRole("button", { name: /Dispatch a new GWAS run/ }));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/already running/);
    expect(screen.getByText(/Go to running run/)).toBeInTheDocument();
  });

  it("maps duplicate_run error with correct copy", () => {
    dispatchState.error = {
      message: "duplicate_run",
      error_code: "duplicate_run",
    } satisfies GwasDispatchRefusal;
    render(wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />));
    fireEvent.click(screen.getByRole("button", { name: /Dispatch a new GWAS run/ }));
    expect(
      screen.getByText(/Check "Overwrite existing run"/),
    ).toBeInTheDocument();
  });
});
