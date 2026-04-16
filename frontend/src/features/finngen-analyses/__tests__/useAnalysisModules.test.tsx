// frontend/src/features/finngen-analyses/__tests__/useAnalysisModules.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAnalysisModules } from "../hooks/useAnalysisModules";

// Mock the API
vi.mock("../api", () => ({
  finngenAnalysesApi: {
    listModules: vi.fn().mockResolvedValue({
      data: [
        {
          key: "co2.codewas",
          label: "CodeWAS",
          description: "Phenome-wide association scan",
          darkstar_endpoint: "/finngen/co2/codewas",
          enabled: true,
          min_role: "researcher",
          settings_schema: { type: "object", required: ["case_cohort_id"] },
          default_settings: { min_cell_count: 5 },
          result_schema: null,
          result_component: "CodeWASResults",
        },
        {
          key: "co2.overlaps",
          label: "Cohort Overlaps",
          description: "Overlap analysis",
          darkstar_endpoint: "/finngen/co2/overlaps",
          enabled: true,
          min_role: "researcher",
          settings_schema: { type: "object", required: ["cohort_ids"] },
          default_settings: {},
          result_schema: null,
          result_component: "OverlapsResults",
        },
      ],
    }),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useAnalysisModules", () => {
  it("returns modules with expected shape", async () => {
    const { result } = renderHook(() => useAnalysisModules(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].key).toBe("co2.codewas");
    expect(result.current.data![0].settings_schema).toBeDefined();
    expect(result.current.data![0].result_component).toBe("CodeWASResults");
  });
});
