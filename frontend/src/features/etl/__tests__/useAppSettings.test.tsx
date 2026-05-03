import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const get = vi.fn();
  return { default: { get }, apiClient: { get } };
});

import { apiClient } from "@/lib/api-client";
import { useAppSettings, useTemplatesEnabled } from "../hooks/useAppSettings";

const mockedGet = vi.mocked(apiClient.get);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => mockedGet.mockReset());

describe("useAppSettings", () => {
  it("fetches /app-settings and exposes the payload", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: {
          ingestion: { templates_enabled: true },
        },
      },
    });
    const { result } = renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGet).toHaveBeenCalledWith("/app-settings");
    expect(result.current.data?.ingestion.templates_enabled).toBe(true);
  });
});

describe("useTemplatesEnabled", () => {
  it("returns false while loading", () => {
    mockedGet.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(() => useTemplatesEnabled(), { wrapper });
    expect(result.current).toBe(false);
  });

  it("returns true when ingestion.templates_enabled is true", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { ingestion: { templates_enabled: true } } },
    });
    const { result } = renderHook(() => useTemplatesEnabled(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("returns false when ingestion.templates_enabled is false", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: { ingestion: { templates_enabled: false } } },
    });
    const { result } = renderHook(() => useTemplatesEnabled(), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("returns false when ingestion key is missing entirely", async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: {} } });
    const { result } = renderHook(() => useTemplatesEnabled(), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });
});
