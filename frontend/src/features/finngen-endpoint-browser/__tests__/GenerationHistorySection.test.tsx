// Phase 15 Plan 08 — GenerationHistorySection smoke tests (UI-SPEC §Section 1).
//
// The exhaustive component test lives in components/__tests__/GenerationHistorySection.test.tsx
// (Plan 15-06). This file adds the Plan 08 Test Map smoke cases: empty state,
// groups-by-source collapsed-by-default, and expand-on-click.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GenerationHistorySection } from "../components/GenerationHistorySection";
import type { EndpointGenerationRun } from "../api";

const baseRun: EndpointGenerationRun = {
  run_id: "01J0PLAN08",
  source_key: "PANCREAS",
  status: "succeeded",
  subject_count: 312,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  finished_at: new Date(Date.now() - 30_000).toISOString(),
};

describe("GenerationHistorySection (Plan 15-08)", () => {
  it("renders empty state when runs is empty", () => {
    render(
      <GenerationHistorySection
        endpointName="E4_DM2"
        longname="Type 2 diabetes"
        cohortDefinitionId={42}
        runs={[]}
      />,
    );
    expect(
      screen.getByText(/This endpoint hasn't been generated yet\./i),
    ).toBeInTheDocument();
  });

  it("groups by source_key and renders each group collapsed by default", () => {
    const runs: EndpointGenerationRun[] = [
      { ...baseRun, run_id: "r1", source_key: "PANCREAS" },
      { ...baseRun, run_id: "r2", source_key: "SYNPUF" },
    ];
    render(
      <GenerationHistorySection
        endpointName="E4_DM2"
        longname="Type 2 diabetes"
        cohortDefinitionId={42}
        runs={runs}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
    buttons.forEach((b) => expect(b).toHaveAttribute("aria-expanded", "false"));
  });

  it("expands a source group on click", () => {
    const runs: EndpointGenerationRun[] = [
      { ...baseRun, run_id: "r1", source_key: "PANCREAS" },
      { ...baseRun, run_id: "r2", source_key: "PANCREAS" },
    ];
    render(
      <GenerationHistorySection
        endpointName="E4_DM2"
        longname="Type 2 diabetes"
        cohortDefinitionId={42}
        runs={runs}
      />,
    );
    const btn = screen.getAllByRole("button")[0];
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});
