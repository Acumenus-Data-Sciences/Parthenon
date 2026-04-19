// Phase 15 Plan 15-07 Task 2 — Stub page + router registration contract.
//
// The Phase 16 PheWeb-lite UI is not in scope for Phase 15. We only
// reserve the deep-link path `/workbench/finngen-endpoints/:name/gwas/:run_id`
// and render an EmptyState stub so the links from GwasRunsSection don't 404.
//
// These tests are standalone (no router.tsx mount) so they don't require
// the authenticated shell. They verify the stub component's contract text
// and the router module's registered path.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, matchRoutes } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import FinnGenGwasResultsStubPage from "../pages/FinnGenGwasResultsStubPage";
import { router } from "@/app/router";

describe("FinnGenGwasResultsStubPage — Phase 16 deep-link stub", () => {
  it("renders the exact UI-SPEC §Deep-Link Forward Compatibility copy", () => {
    render(
      <MemoryRouter>
        <FinnGenGwasResultsStubPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("GWAS results page")).toBeInTheDocument();
    expect(
      screen.getByText("This page ships in Phase 16 (PheWeb-lite UI)."),
    ).toBeInTheDocument();
  });

  it("registers the Phase 16 deep-link path at /workbench/finngen-endpoints/:name/gwas/:run_id", () => {
    // Use the real router's route table (not a remount) so the invariant is
    // the composed URL path — what React Router actually resolves — rather
    // than the literal string shape inside the route object.
    const match = matchRoutes(
      router.routes as RouteObject[],
      "/workbench/finngen-endpoints/E4_DM2/gwas/01JA000000000000000000000",
    );
    expect(match).not.toBeNull();
    // Deepest match must be the stub route — the full path on its last pathMatch
    // segment must contain the `:name/gwas/:run_id` pattern. Params populate.
    const params = match?.[match.length - 1]?.params ?? {};
    expect(params.name).toBe("E4_DM2");
    expect(params.run_id).toBe("01JA000000000000000000000");
  });
});
