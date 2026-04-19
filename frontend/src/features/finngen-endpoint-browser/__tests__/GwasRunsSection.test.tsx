// Phase 15 Plan 08 — GwasRunsSection smoke tests (UI-SPEC §Section 2).
//
// The exhaustive component test lives in components/__tests__/GwasRunsSection.test.tsx
// (Plan 15-06). This file adds Plan 08 Test Map cases: empty state, flat
// newest-first list, and superseded back-link rendering.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import { GwasRunsSection } from "../components/GwasRunsSection";
import type { EndpointGwasRun } from "../api";

const makeRun = (overrides: Partial<EndpointGwasRun> = {}): EndpointGwasRun => ({
  tracking_id: 1,
  run_id: "01JPLAN080000000000000001",
  step1_run_id: null,
  source_key: "PANCREAS",
  control_cohort_id: 221,
  control_cohort_name: "PANCREAS Healthy controls",
  covariate_set_id: 1,
  covariate_set_label: "Default",
  case_n: 312,
  control_n: 9421,
  top_hit_p_value: 4.2e-9,
  status: "succeeded",
  created_at: "2026-04-21T10:00:00Z",
  finished_at: "2026-04-21T10:30:00Z",
  superseded_by_tracking_id: null,
  ...overrides,
});

function wrap(children: ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("GwasRunsSection (Plan 15-08)", () => {
  it("renders empty state when runs is empty", () => {
    render(wrap(<GwasRunsSection endpointName="E4_DM2" runs={[]} />));
    expect(
      screen.getByText(/No GWAS runs yet — dispatch one below\./i),
    ).toBeInTheDocument();
  });

  it("renders a flat list of runs newest-first with Phase-16 deep links", () => {
    const first = makeRun({ tracking_id: 1, run_id: "01NEWEST" });
    const second = makeRun({ tracking_id: 2, run_id: "01OLDER" });
    render(wrap(<GwasRunsSection endpointName="E4_DM2" runs={[first, second]} />));
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(2);
    expect(items[0].querySelector("a")?.getAttribute("href")).toContain("01NEWEST");
    expect(items[1].querySelector("a")?.getAttribute("href")).toContain("01OLDER");
  });

  it("renders superseded rows muted with a replacement back-link", () => {
    const run = makeRun({
      status: "superseded",
      superseded_by_tracking_id: 99,
    });
    render(wrap(<GwasRunsSection endpointName="E4_DM2" runs={[run]} />));
    expect(screen.getByText(/replaced by run #99/i)).toBeInTheDocument();
    const link = screen.getByRole("listitem").querySelector("a");
    expect(link?.className).toMatch(/opacity-60/);
  });
});
