import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";

import { useFinnGenSyncRead } from "../hooks/useFinnGenSyncRead";

let mock: MockAdapter;

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

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

describe("useFinnGenSyncRead", () => {
  it("passes params to the request", async () => {
    const client = makeClient();
    mock.onGet("/finngen/sync/romopapi/code-counts").reply(200, { concept: { concept_id: 1 } });

    const { result } = renderHook(
      () => useFinnGenSyncRead("romopapi/code-counts", { source: "EUNOMIA", concept_id: 1 }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mock.history.get[0]?.params).toMatchObject({ source: "EUNOMIA", concept_id: 1 });
    expect(mock.history.get[0]?.params).not.toHaveProperty("refresh");
  });

  it("passes refresh=true when opts.refresh is set", async () => {
    const client = makeClient();
    mock.onGet("/finngen/sync/romopapi/code-counts").reply(200, { concept: {} });

    const { result } = renderHook(
      () =>
        useFinnGenSyncRead(
          "romopapi/code-counts",
          { source: "EUNOMIA", concept_id: 1 },
          { refresh: true },
        ),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mock.history.get[0]?.params).toMatchObject({ refresh: "true" });
  });
});
