// Phase 15 (Plan 15-05) — TanStack Query hooks: useDispatchGwas,
// useEligibleControlCohorts, useCovariateSets. Verifies query key shapes,
// enabled conditions, staleTimes, and the critical invalidation behavior that
// refreshes the endpoint detail drawer + eligible-controls picker after a
// successful dispatch.
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useCovariateSets } from "../hooks/useCovariateSets";
import { useDispatchGwas } from "../hooks/useDispatchGwas";
import { useEligibleControlCohorts } from "../hooks/useEligibleControlCohorts";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    dispatchGwas: vi.fn(),
    fetchEligibleControls: vi.fn(),
    fetchCovariateSets: vi.fn(),
  };
});

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, Wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useDispatchGwas", () => {
  it("invalidates endpoint detail + eligible-controls for this source on success", async () => {
    vi.mocked(api.dispatchGwas).mockResolvedValueOnce({
      data: {
        gwas_run: {
          tracking_id: 1,
          run_id: "r1",
          step1_run_id: null,
          source_key: "PANCREAS",
          control_cohort_id: 7,
          control_cohort_name: null,
          covariate_set_id: 0,
          covariate_set_label: null,
          case_n: null,
          control_n: null,
          top_hit_p_value: null,
          status: "queued",
          created_at: "2026-04-18T00:00:00Z",
          finished_at: null,
          superseded_by_tracking_id: null,
        },
        cached_step1: false,
      },
    });

    const { qc, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useDispatchGwas("E4_DM2"), {
      wrapper: Wrapper,
    });

    result.current.mutate({ source_key: "PANCREAS", control_cohort_id: 7 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.dispatchGwas).toHaveBeenCalledWith("E4_DM2", {
      source_key: "PANCREAS",
      control_cohort_id: 7,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["finngen-endpoints", "detail", "E4_DM2"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [
        "finngen-endpoints",
        "E4_DM2",
        "eligible-controls",
        "PANCREAS",
      ],
    });
  });
});

describe("useEligibleControlCohorts", () => {
  it("uses the ['finngen-endpoints', name, 'eligible-controls', source] queryKey", async () => {
    vi.mocked(api.fetchEligibleControls).mockResolvedValueOnce([
      {
        cohort_definition_id: 1,
        name: "n",
        subject_count: 1,
        last_generated_at: "2026-04-01T00:00:00Z",
      },
    ]);
    const { qc, Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useEligibleControlCohorts({ endpointName: "E4_DM2", sourceKey: "PANCREAS" }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const state = qc.getQueryState([
      "finngen-endpoints",
      "E4_DM2",
      "eligible-controls",
      "PANCREAS",
    ]);
    expect(state?.status).toBe("success");
    expect(api.fetchEligibleControls).toHaveBeenCalledWith("E4_DM2", "PANCREAS");
  });

  it("is disabled when sourceKey is empty", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useEligibleControlCohorts({ endpointName: "E4_DM2", sourceKey: "" }),
      { wrapper: Wrapper },
    );
    // Give the query a tick to ever fire. It should not.
    await new Promise((r) => setTimeout(r, 20));
    expect(api.fetchEligibleControls).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("is disabled when endpointName is empty", async () => {
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useEligibleControlCohorts({ endpointName: "", sourceKey: "PANCREAS" }),
      { wrapper: Wrapper },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(api.fetchEligibleControls).not.toHaveBeenCalled();
  });
});

describe("useCovariateSets", () => {
  it("uses the ['finngen', 'covariate-sets'] queryKey", async () => {
    vi.mocked(api.fetchCovariateSets).mockResolvedValueOnce([
      { id: 0, name: "Default", is_default: true, description: null },
    ]);
    const { qc, Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCovariateSets(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const state = qc.getQueryState(["finngen", "covariate-sets"]);
    expect(state?.status).toBe("success");
    expect(result.current.data).toEqual([
      { id: 0, name: "Default", is_default: true, description: null },
    ]);
  });
});
