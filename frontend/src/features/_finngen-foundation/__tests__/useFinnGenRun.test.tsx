import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";

import { useFinnGenRun } from "../hooks/useFinnGenRun";

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe("useFinnGenRun", () => {
  it("returns null and does not fetch when id is null", () => {
    const client = makeClient();
    const { result } = renderHook(() => useFinnGenRun(null), { wrapper: wrapper(client) });
    expect(result.current.data).toBeUndefined();
    expect(mock.history.get.length).toBe(0);
  });

  it("fetches the run when id is provided", async () => {
    const client = makeClient();
    mock.onGet("/finngen/runs/run_123").reply(200, {
      id: "run_123",
      user_id: 1,
      source_key: "EUNOMIA",
      analysis_type: "co2.codewas",
      params: {},
      status: "running",
      progress: null,
      artifacts: {},
      summary: null,
      error: null,
      pinned: false,
      artifacts_pruned: false,
      darkstar_job_id: null,
      horizon_job_id: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const { result } = renderHook(() => useFinnGenRun("run_123"), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.data?.id).toBe("run_123"));
    expect(result.current.data?.status).toBe("running");
  });
});
