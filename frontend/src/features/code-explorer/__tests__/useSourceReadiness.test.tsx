import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { useSourceReadiness } from "../hooks/useSourceReadiness";

let mock: MockAdapter;
const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe("useSourceReadiness", () => {
  it("fetches readiness for the given source", async () => {
    const client = makeClient();
    mock.onGet("/finngen/code-explorer/source-readiness").reply(200, {
      source_key: "EUNOMIA",
      ready: false,
      missing: ["stratified_code_counts"],
      setup_run_id: null,
    });
    const { result } = renderHook(() => useSourceReadiness("EUNOMIA"), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.data?.source_key).toBe("EUNOMIA"));
    expect(result.current.data?.ready).toBe(false);
  });

  it("is disabled when sourceKey is null", () => {
    const client = makeClient();
    const { result } = renderHook(() => useSourceReadiness(null), { wrapper: wrapper(client) });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
