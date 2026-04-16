// SP4 Phase C — usePreviewCounts hook tests. Verifies happy path, structured
// validation error mapping (422), and Darkstar timeout/unreachable mapping.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/api-client", () => {
  const post = vi.fn();
  return {
    default: { post, get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    __post: post,
  };
});

import { usePreviewCounts } from "../hooks/usePreviewCounts";
import { makeCohort, makeOp } from "../lib/operationTree";
import apiClient from "@/lib/api-client";

const post = (apiClient as unknown as { post: ReturnType<typeof vi.fn> }).post;

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => {
  post.mockReset();
});

describe("usePreviewCounts", () => {
  it("returns total + operation_string + cohort_ids on 200", async () => {
    post.mockResolvedValueOnce({
      data: { data: { total: 1234, cohort_ids: [221, 222], operation_string: "221 UNION 222" } },
    });

    const { result } = renderHook(() => usePreviewCounts("PANCREAS"), { wrapper });
    act(() => {
      result.current.mutate({ tree: makeOp("UNION", [makeCohort(221), makeCohort(222)]) });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      total: 1234,
      cohort_ids: [221, 222],
      operation_string: "221 UNION 222",
    });
  });

  it("maps 422 to a structured validation error", async () => {
    const axiosErr = {
      isAxiosError: true,
      message: "Request failed with status code 422",
      response: {
        status: 422,
        data: {
          message: "Operation tree failed validation",
          errors: [{ node_id: "x", code: "OP_NEEDS_AT_LEAST_TWO_CHILDREN", message: "..." }],
        },
      },
    };
    post.mockRejectedValueOnce(axiosErr);

    const { result } = renderHook(() => usePreviewCounts("PANCREAS"), { wrapper });
    act(() => {
      result.current.mutate({ tree: makeCohort(1) });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("validation");
    expect(result.current.error?.validation).toHaveLength(1);
    expect(result.current.error?.validation?.[0].code).toBe("OP_NEEDS_AT_LEAST_TWO_CHILDREN");
  });

  it("maps 504 to a timeout/darkstar error", async () => {
    post.mockRejectedValueOnce({
      isAxiosError: true,
      message: "timeout",
      response: { status: 504, data: {} },
    });
    const { result } = renderHook(() => usePreviewCounts("PANCREAS"), { wrapper });
    act(() => {
      result.current.mutate({ tree: makeCohort(1) });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("darkstar");
    expect(result.current.error?.message).toMatch(/timed out/i);
  });

  it("maps 502 to darkstar unreachable", async () => {
    post.mockRejectedValueOnce({
      isAxiosError: true,
      message: "bad gateway",
      response: { status: 502, data: {} },
    });
    const { result } = renderHook(() => usePreviewCounts("PANCREAS"), { wrapper });
    act(() => {
      result.current.mutate({ tree: makeCohort(1) });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("darkstar");
    expect(result.current.error?.message).toMatch(/unreachable/i);
  });
});
