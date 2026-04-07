import { createElement } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import apiClient from "@/lib/api-client";
import { useWikiQuery } from "../api/wiki";

vi.mock("@/lib/api-client", () => ({
  default: {
    post: vi.fn(),
  },
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("useWikiQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { workspace: "platform", answer: "Answer", citations: [] },
    } as never);
  });

  it("sends selected page scope using backend field names", async () => {
    const { result } = renderHook(() => useWikiQuery(), { wrapper: makeWrapper() });

    result.current.mutate({
      workspace: "platform",
      question: "Summarize this paper",
      pageSlug: "paper-a-findings",
      sourceSlug: "paper-a",
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiClient.post).toHaveBeenCalledWith("/wiki/query", {
      workspace: "platform",
      question: "Summarize this paper",
      page_slug: "paper-a-findings",
      source_slug: "paper-a",
    });
  });
});
