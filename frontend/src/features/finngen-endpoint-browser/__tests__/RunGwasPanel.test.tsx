// Phase 15 Plan 08 — RunGwasPanel state-machine smoke tests (UI-SPEC §Section 3).
//
// The exhaustive component test lives in components/__tests__/RunGwasPanel.test.tsx
// (Plan 15-06). This file targets the five Plan 08 Test Map cases:
//   - collapsed default / disabled when no source ready
//   - default covariate set auto-select
//   - 409 run_in_flight banner navigation
//   - 409 duplicate_run banner with overwrite copy
//   - CTA disabled until all fields complete
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import type {
  CovariateSetSummary,
  EligibleControlCohort,
  EndpointDetailWithPhase15,
  EndpointGenerationRun,
  GwasDispatchRefusal,
} from "../api";

const mutateMock = vi.fn();
const dispatchState: {
  isPending: boolean;
  error: GwasDispatchRefusal | Error | null;
} = { isPending: false, error: null };

vi.mock("../hooks/useDispatchGwas", () => ({
  useDispatchGwas: () => ({
    mutate: mutateMock,
    isPending: dispatchState.isPending,
    error: dispatchState.error,
  }),
}));

const eligibleControlsData: EligibleControlCohort[] = [
  {
    cohort_definition_id: 221,
    name: "PANCREAS Healthy controls",
    subject_count: 9421,
    last_generated_at: new Date().toISOString(),
  },
];

vi.mock("../hooks/useEligibleControlCohorts", () => ({
  useEligibleControlCohorts: () => ({ data: eligibleControlsData, isLoading: false }),
}));

const covariateSets: CovariateSetSummary[] = [
  { id: 1, name: "Default: age + sex + 10 PCs", is_default: true, description: null },
];

vi.mock("../hooks/useCovariateSets", () => ({
  useCovariateSets: () => ({ data: covariateSets }),
}));

import { RunGwasPanel } from "../components/RunGwasPanel";

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

function wrap(children: ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("RunGwasPanel (Plan 15-08)", () => {
  beforeEach(() => {
    mutateMock.mockReset();
    dispatchState.isPending = false;
    dispatchState.error = null;
  });

  it("is collapsed by default and trigger is disabled when no gwas_ready_sources", () => {
    const none = { ...endpoint, gwas_ready_sources: [] };
    render(wrap(<RunGwasPanel endpoint={none} generationRuns={[]} />));
    const trigger = screen.getByRole("button", {
      name: /Generate this endpoint first/i,
    });
    expect(trigger).toBeDisabled();
  });

  it("preselects the default covariate set", () => {
    render(
      wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Dispatch a new GWAS run/i }),
    );
    // Default chip visible in the expanded pickers.
    expect(
      screen.getByText(/Default: age \+ sex \+ 10 PCs/i),
    ).toBeInTheDocument();
  });

  it("shows run_in_flight banner with Go-to-running-run link on 409", () => {
    dispatchState.error = {
      message: "run_in_flight",
      error_code: "run_in_flight",
      existing_run_id: "01JEXIST",
    } satisfies GwasDispatchRefusal;
    render(
      wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Dispatch a new GWAS run/i }),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/already running/i);
    expect(screen.getByText(/Go to running run/i)).toBeInTheDocument();
  });

  it("surfaces duplicate_run copy prompting overwrite", () => {
    dispatchState.error = {
      message: "duplicate_run",
      error_code: "duplicate_run",
    } satisfies GwasDispatchRefusal;
    render(
      wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Dispatch a new GWAS run/i }),
    );
    expect(
      screen.getByText(/Check "Overwrite existing run"/i),
    ).toBeInTheDocument();
  });

  it("CTA is disabled until source + control are both chosen", () => {
    render(
      wrap(<RunGwasPanel endpoint={endpoint} generationRuns={[generationRun]} />),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Dispatch a new GWAS run/i }),
    );
    const cta = screen.getByRole("button", { name: "Run GWAS" });
    expect(cta).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "PANCREAS" },
    });
    expect(cta).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Control cohort"), {
      target: { value: "221" },
    });
    expect(cta).toBeEnabled();
  });
});
