// Phase 15 Plan 08 — useDispatchGwas hook invalidation contract test.
//
// Verifies the Plan 15-05 invalidation contract: on successful dispatch, the
// hook invalidates (1) the endpoint detail drawer and (2) the eligible-controls
// picker for the target source. The broader hook suite lives in hooks.phase15.test.tsx;
// this file is the Plan 08 Test Map authoritative check.
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useDispatchGwas } from "../hooks/useDispatchGwas";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    dispatchGwas: vi.fn(),
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

describe("useDispatchGwas (Plan 15-08)", () => {
  it("invalidates endpoint detail + eligible-controls queries on success", async () => {
    vi.mocked(api.dispatchGwas).mockResolvedValueOnce({
      data: {
        gwas_run: {
          tracking_id: 7,
          run_id: "01JPLAN08",
          step1_run_id: null,
          source_key: "PANCREAS",
          control_cohort_id: 221,
          control_cohort_name: null,
          covariate_set_id: 1,
          covariate_set_label: null,
          case_n: null,
          control_n: null,
          top_hit_p_value: null,
          status: "queued",
          created_at: "2026-04-21T10:00:00Z",
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

    result.current.mutate({ source_key: "PANCREAS", control_cohort_id: 221 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

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
