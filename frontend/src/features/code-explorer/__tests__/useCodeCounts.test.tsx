import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { useCodeCounts } from "../hooks/useCodeCounts";

let mock: MockAdapter;
const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe("useCodeCounts", () => {
  it("returns data on happy path", async () => {
    const client = makeClient();
    mock.onGet("/finngen/code-explorer/counts").reply(200, {
      concept: { concept_id: 201826, concept_name: "Diabetes" },
      stratified_counts: [],
      node_count: 0,
      descendant_count: 0,
    });
    const { result } = renderHook(() => useCodeCounts("EUNOMIA", 201826), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.data?.concept.concept_id).toBe(201826));
  });

  it("propagates setup-needed error body", async () => {
    const client = makeClient();
    mock.onGet("/finngen/code-explorer/counts").reply(422, {
      error: {
        code: "FINNGEN_SOURCE_NOT_INITIALIZED",
        message: "needs setup",
        action: { type: "initialize_source", source_key: "EUNOMIA" },
      },
    });
    const { result } = renderHook(() => useCodeCounts("EUNOMIA", 1), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
