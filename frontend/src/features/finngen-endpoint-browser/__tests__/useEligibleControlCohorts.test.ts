// Phase 15 Plan 08 — useEligibleControlCohorts enabled-gating + URL threading.
//
// Verifies the hook is disabled when sourceKey is empty (picker defers its first
// fetch until the user picks a source) and that it threads source_key through to
// fetchEligibleControls. Comprehensive hook suite is in hooks.phase15.test.tsx.
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useEligibleControlCohorts } from "../hooks/useEligibleControlCohorts";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    fetchEligibleControls: vi.fn(),
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

describe("useEligibleControlCohorts (Plan 15-08)", () => {
  it("is disabled when sourceKey is empty", async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useEligibleControlCohorts({ endpointName: "E4_DM2", sourceKey: "" }),
      { wrapper: Wrapper },
    );
    // Give the query loop a tick; enabled=false → never fires.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.fetchEligibleControls).not.toHaveBeenCalled();
  });

  it("threads source_key through to fetchEligibleControls", async () => {
    vi.mocked(api.fetchEligibleControls).mockResolvedValueOnce([
      {
        cohort_definition_id: 221,
        name: "PANCREAS Healthy controls",
        subject_count: 9421,
        last_generated_at: new Date().toISOString(),
      },
    ]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useEligibleControlCohorts({
          endpointName: "E4_DM2",
          sourceKey: "PANCREAS",
        }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.fetchEligibleControls).toHaveBeenCalledWith("E4_DM2", "PANCREAS");
  });
});
