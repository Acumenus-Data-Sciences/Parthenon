// Phase 15 Plan 15-06 — GenerationHistorySection tests (UI-SPEC §Layout Section 1).
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GenerationHistorySection } from "../GenerationHistorySection";
import type { EndpointGenerationRun } from "../../api";

const baseRun: EndpointGenerationRun = {
  run_id: "01J0AAAA",
  source_key: "PANCREAS",
  status: "succeeded",
  subject_count: 312,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  finished_at: new Date(Date.now() - 30_000).toISOString(),
};

describe("GenerationHistorySection", () => {
  it("renders the empty-state when runs is empty", () => {
    render(
      <GenerationHistorySection
        endpointName="E4_DM2"
        longname="Type 2 diabetes"
        cohortDefinitionId={42}
        runs={[]}
      />,
    );
    expect(
      screen.getByText("This endpoint hasn't been generated yet."),
    ).toBeInTheDocument();
  });

  it("renders one group header per source_key, collapsed by default", () => {
    const runs: EndpointGenerationRun[] = [
      { ...baseRun, run_id: "01J01", source_key: "PANCREAS" },
      {
        ...baseRun,
        run_id: "01J02",
        source_key: "SYNPUF",
        status: "failed",
        subject_count: null,
      },
    ];
    render(
      <GenerationHistorySection
        endpointName="E4_DM2"
        longname="Type 2 diabetes"
        cohortDefinitionId={42}
        runs={runs}
      />,
    );
    // Two group buttons.
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2);
    buttons.forEach((b) => expect(b).toHaveAttribute("aria-expanded", "false"));
  });

  it("expands a source group on click and shows its runs", () => {
    const runs: EndpointGenerationRun[] = [
      { ...baseRun, run_id: "01J01", source_key: "PANCREAS", subject_count: 100 },
      { ...baseRun, run_id: "01J02", source_key: "PANCREAS", subject_count: 200 },
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

  it("renders the overflow disclosure when totalCount > runs.length", () => {
    const runs: EndpointGenerationRun[] = [baseRun];
    render(
      <GenerationHistorySection
        endpointName="E4_DM2"
        longname="Type 2 diabetes"
        cohortDefinitionId={42}
        runs={runs}
        totalCount={42}
      />,
    );
    expect(screen.getByText(/Show older runs/)).toBeInTheDocument();
  });
});
