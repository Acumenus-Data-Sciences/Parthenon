// Phase 15 (Plan 15-05) — api.ts extensions: dispatchGwas, fetchEligibleControls,
// fetchCovariateSets. Exercises the 4xx refusal unwrap, the 404 fallback, and
// the URL shape of the three new HTTP calls.
import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "@/lib/api-client";
import {
  dispatchGwas,
  fetchCovariateSets,
  fetchEligibleControls,
  type CovariateSetSummary,
  type DispatchGwasPayload,
  type DispatchGwasResponse,
  type EligibleControlCohort,
  type GwasDispatchRefusal,
} from "../api";

vi.mock("@/lib/api-client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dispatchGwas", () => {
  it("POSTs to /finngen/endpoints/{name}/gwas with encoded name + payload", async () => {
    const payload: DispatchGwasPayload = {
      source_key: "PANCREAS",
      control_cohort_id: 42,
      covariate_set_id: null,
    };
    const response: DispatchGwasResponse = {
      data: {
        gwas_run: {
          tracking_id: 1,
          run_id: "run-1",
          step1_run_id: null,
          source_key: "PANCREAS",
          control_cohort_id: 42,
          control_cohort_name: "Pancreas cohort",
          covariate_set_id: 0,
          covariate_set_label: "Default",
          case_n: 100,
          control_n: 1000,
          top_hit_p_value: null,
          status: "queued",
          created_at: "2026-04-18T00:00:00Z",
          finished_at: null,
          superseded_by_tracking_id: null,
        },
        cached_step1: false,
      },
    };
    mockedPost.mockResolvedValueOnce({ data: response } as never);

    const result = await dispatchGwas("C3_HAEMATOLOGICAL_MALIGNANCIES", payload);

    expect(mockedPost).toHaveBeenCalledWith(
      "/finngen/endpoints/C3_HAEMATOLOGICAL_MALIGNANCIES/gwas",
      payload,
    );
    expect(result).toEqual(response);
  });

  it("URL-encodes endpoint names with special characters", async () => {
    mockedPost.mockResolvedValueOnce({ data: { data: {} } } as never);
    await dispatchGwas("F5/ALCO HOL", {
      source_key: "PANCREAS",
      control_cohort_id: 1,
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/finngen/endpoints/F5%2FALCO%20HOL/gwas",
      expect.any(Object),
    );
  });

  it.each([422, 409, 403, 404])(
    "throws the typed refusal body (not the AxiosError) on %d",
    async (status) => {
      const refusal: GwasDispatchRefusal = {
        message: "Run already in flight",
        error_code: "run_in_flight",
        existing_run_id: "run-xyz",
      };
      mockedPost.mockRejectedValueOnce({
        response: { status, data: refusal },
      });
      await expect(
        dispatchGwas("E4_DM2", { source_key: "PANCREAS", control_cohort_id: 1 }),
      ).rejects.toEqual(refusal);
    },
  );

  it("re-throws the original error on network / 5xx failures", async () => {
    const err = new Error("Network down");
    mockedPost.mockRejectedValueOnce(err);
    await expect(
      dispatchGwas("E4_DM2", { source_key: "PANCREAS", control_cohort_id: 1 }),
    ).rejects.toBe(err);
  });
});

describe("fetchEligibleControls", () => {
  it("GETs the eligible-controls route with source_key param and unwraps .data.data", async () => {
    const list: EligibleControlCohort[] = [
      {
        cohort_definition_id: 42,
        name: "Adults over 18",
        subject_count: 10000,
        last_generated_at: "2026-04-10T00:00:00Z",
      },
    ];
    mockedGet.mockResolvedValueOnce({ data: { data: list } } as never);

    const result = await fetchEligibleControls("I9_HYPTENSESS", "PANCREAS");

    expect(mockedGet).toHaveBeenCalledWith(
      "/finngen/endpoints/I9_HYPTENSESS/eligible-controls",
      { params: { source_key: "PANCREAS" } },
    );
    expect(result).toEqual(list);
  });
});

describe("fetchCovariateSets", () => {
  it("GETs /finngen/gwas-covariate-sets and unwraps .data.data", async () => {
    const list: CovariateSetSummary[] = [
      { id: 1, name: "Age + sex + 10 PCs", is_default: true, description: null },
    ];
    mockedGet.mockResolvedValueOnce({ data: { data: list } } as never);

    const result = await fetchCovariateSets();

    expect(mockedGet).toHaveBeenCalledWith("/finngen/gwas-covariate-sets");
    expect(result).toEqual(list);
  });

  it("returns a hard-coded default on 404 per UI-SPEC Assumption 10", async () => {
    mockedGet.mockRejectedValueOnce({ response: { status: 404 } });

    const result = await fetchCovariateSets();

    expect(result).toEqual([
      {
        id: 0,
        name: "Default: age + sex + 10 PCs",
        is_default: true,
        description: null,
      },
    ]);
  });

  it("re-throws non-404 errors", async () => {
    const err = new Error("boom");
    mockedGet.mockRejectedValueOnce(err);
    await expect(fetchCovariateSets()).rejects.toBe(err);
  });
});
