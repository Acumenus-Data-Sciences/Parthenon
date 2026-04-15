import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { useCreateReport } from "../hooks/useCreateReport";

let mock: MockAdapter;

beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe("useCreateReport", () => {
  it("dispatches POST with Idempotency-Key header and returns run", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mock.onPost("/finngen/code-explorer/report").reply((config) => {
      expect(config.headers?.["Idempotency-Key"]).toBeTruthy();
      return [201, { id: "run_abc", analysis_type: "romopapi.report" }];
    });

    const { result } = renderHook(() => useCreateReport(), { wrapper: wrapper(client) });
    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({ sourceKey: "EUNOMIA", conceptId: 201826 });
    });
    await waitFor(() => expect((response as { id: string })?.id).toBe("run_abc"));
  });

  it("resetIdempotencyKey changes the key", async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useCreateReport(), { wrapper: wrapper(client) });
    const before = result.current.idempotencyKey;
    act(() => result.current.resetIdempotencyKey());
    await waitFor(() => expect(result.current.idempotencyKey).not.toBe(before));
  });
});
