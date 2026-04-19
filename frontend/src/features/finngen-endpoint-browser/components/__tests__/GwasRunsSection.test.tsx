// Phase 15 Plan 15-06 — GwasRunsSection tests (UI-SPEC §Layout Section 2).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { GwasRunsSection } from "../GwasRunsSection";
import type { EndpointGwasRun } from "../../api";

const baseRun: EndpointGwasRun = {
  tracking_id: 1,
  run_id: "01JABC",
  step1_run_id: null,
  source_key: "PANCREAS",
  control_cohort_id: 221,
  control_cohort_name: "Healthy controls",
  covariate_set_id: 1,
  covariate_set_label: "Default",
  case_n: 312,
  control_n: 9421,
  top_hit_p_value: 4.2e-9,
  status: "succeeded",
  created_at: new Date(Date.now() - 60_000).toISOString(),
  finished_at: new Date(Date.now() - 30_000).toISOString(),
  superseded_by_tracking_id: null,
};

function wrap(children: React.ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("GwasRunsSection", () => {
  it("renders the empty-state when runs is empty", () => {
    render(wrap(<GwasRunsSection endpointName="E4_DM2" runs={[]} />));
    expect(
      screen.getByText("No GWAS runs yet — dispatch one below."),
    ).toBeInTheDocument();
  });

  it("renders a Phase 16 deep-link for each run", () => {
    render(wrap(<GwasRunsSection endpointName="E4_DM2" runs={[baseRun]} />));
    const link = screen.getByRole("listitem").querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toContain(
      "/workbench/finngen-endpoints/E4_DM2/gwas/01JABC",
    );
  });

  it("formats case/control counts with locale commas", () => {
    render(wrap(<GwasRunsSection endpointName="E4_DM2" runs={[baseRun]} />));
    expect(screen.getByText("312 / 9,421")).toBeInTheDocument();
  });

  it("formats the top-hit p-value in scientific notation", () => {
    render(wrap(<GwasRunsSection endpointName="E4_DM2" runs={[baseRun]} />));
    expect(screen.getByText(/top hit: p=4\.2e-9/)).toBeInTheDocument();
  });

  it("mutes superseded rows and renders a replacement back-link", () => {
    const replacement: EndpointGwasRun = {
      ...baseRun,
      tracking_id: 2,
      run_id: "01JREPL",
      status: "succeeded",
      superseded_by_tracking_id: null,
    };
    const superseded: EndpointGwasRun = {
      ...baseRun,
      tracking_id: 1,
      run_id: "01JORIG",
      status: "superseded",
      superseded_by_tracking_id: 2,
    };
    render(
      wrap(
        <GwasRunsSection
          endpointName="E4_DM2"
          runs={[replacement, superseded]}
        />,
      ),
    );
    expect(screen.getByText("replaced by run #2")).toBeInTheDocument();
    // Superseded wrapper gets opacity-60.
    const supersededLink = screen
      .getAllByRole("listitem")
      .find((el) => el.querySelector('a[href*="01JORIG"]'));
    expect(supersededLink?.querySelector("a")?.className).toContain("opacity-60");
  });

  it("clamps tiny p-values to '<1e-300'", () => {
    const tiny: EndpointGwasRun = { ...baseRun, top_hit_p_value: 1e-310 };
    render(wrap(<GwasRunsSection endpointName="E4_DM2" runs={[tiny]} />));
    expect(screen.getByText(/top hit: p=<1e-300/)).toBeInTheDocument();
  });

  it("carries role=list and aria-live=polite on the container", () => {
    const { container } = render(
      wrap(<GwasRunsSection endpointName="E4_DM2" runs={[baseRun]} />),
    );
    const listBox = container.querySelector('[role="list"]');
    expect(listBox).toBeTruthy();
    expect(listBox?.getAttribute("aria-live")).toBe("polite");
  });
});
