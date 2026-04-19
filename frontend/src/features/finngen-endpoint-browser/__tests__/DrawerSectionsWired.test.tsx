// Phase 15 Plan 15-07 — Drawer wiring integration test.
//
// Asserts that EndpointDetailBody renders the three Phase 15 sections
// (Generation history / GWAS runs / Run GWAS) in drawer order (top→bottom)
// when the detail response carries the Plan 04 Phase 15 arrays.
// Also asserts the legacy inline "endpoint.generations.map(...)" block is gone
// (the section is sourced from generation_runs, not generations).
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { FinnGenEndpointBrowserPage } from "../pages/FinnGenEndpointBrowserPage";
import * as api from "../api";

vi.mock("../api");
vi.mock("@/features/data-sources/api/sourcesApi", () => ({
  fetchSources: vi.fn().mockResolvedValue([
    { id: 1, source_key: "PANCREAS", source_name: "Pancreatic Corpus" },
  ]),
}));

describe("FinnGenEndpointBrowserPage — drawer wires Phase 15 sections (Plan 07)", () => {
  it("renders Generation history, GWAS runs, and Run GWAS sections in order; does not render legacy generations.map block", async () => {
    const detail = {
      id: 42,
      name: "E4_DM2",
      longname: "Type 2 Diabetes",
      description: "T2D",
      tags: ["finngen-endpoint"],
      release: "df14",
      coverage_bucket: "FULLY_MAPPED",
      coverage_profile: "global",
      coverage: { bucket: "FULLY_MAPPED", pct: 0.98, n_tokens_total: 120, n_tokens_resolved: 118 },
      level: 1,
      sex_restriction: null,
      include_endpoints: [],
      pre_conditions: null,
      conditions: null,
      source_codes: null,
      resolved_concepts: {
        condition_count: 20,
        drug_count: 5,
        source_concept_count: 15,
        truncated: false,
      },
      // Legacy field still populated for back-compat; drawer should NOT render
      // any inline map over it (Plan 07 removes the legacy block).
      generations: [
        { source_key: "PANCREAS", run_id: "01LEGACY", status: "succeeded", subject_count: 111, finished_at: null },
      ],
      // Plan 04 arrays — drawer renders these instead.
      generation_runs: [
        {
          run_id: "01GEN1",
          source_key: "PANCREAS",
          status: "succeeded",
          subject_count: 312,
          created_at: "2026-04-18T12:00:00Z",
          finished_at: "2026-04-18T12:05:00Z",
        },
      ],
      gwas_runs: [
        {
          tracking_id: 7,
          run_id: "01GWAS1",
          step1_run_id: null,
          source_key: "PANCREAS",
          control_cohort_id: 221,
          control_cohort_name: "PDAC controls",
          covariate_set_id: 1,
          covariate_set_label: "Default (age + sex + 10 PCs)",
          case_n: 312,
          control_n: 9421,
          top_hit_p_value: 4.2e-9,
          status: "succeeded",
          created_at: "2026-04-18T14:00:00Z",
          finished_at: "2026-04-18T14:12:00Z",
          superseded_by_tracking_id: null,
        },
      ],
      gwas_ready_sources: ["PANCREAS"],
      created_at: null,
      updated_at: null,
    };

    vi.spyOn(api, "fetchEndpoint").mockResolvedValue(detail as never);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/?endpoint=E4_DM2"]}>
          <FinnGenEndpointBrowserPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Three Phase 15 section eyebrows must be present.
    const genHeading = await screen.findByText("Generation history");
    const gwasHeading = await screen.findByText("GWAS runs");
    const dispatchHeading = await screen.findByText("Run GWAS");

    // Drawer order (top→bottom): generation → gwas → dispatch.
    const all = [genHeading, gwasHeading, dispatchHeading];
    for (let i = 0; i < all.length - 1; i++) {
      const position = all[i].compareDocumentPosition(all[i + 1]);
      // DOCUMENT_POSITION_FOLLOWING = 4
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    // GWAS row from generation_runs array should be visible (312 subjects).
    // The Generation History section expands/collapses per source; the source
    // group header row always renders with the latest status + subject count.
    const genSection = genHeading.closest("section");
    expect(genSection).not.toBeNull();
    expect(within(genSection as HTMLElement).getByText(/PANCREAS/)).toBeInTheDocument();

    // The legacy subject count "111" from endpoint.generations[] must NOT appear
    // because the drawer now consumes generation_runs (312) — proves the inline
    // block was removed.
    expect(screen.queryByText(/111 subjects/i)).not.toBeInTheDocument();
  });
});
