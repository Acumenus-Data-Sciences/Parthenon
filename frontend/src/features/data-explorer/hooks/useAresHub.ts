import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { AresHubKpis } from "../types/ares";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

export function useAresHubKpis() {
  return useQuery({
    queryKey: ["ares", "hub", "kpis"],
    queryFn: async (): Promise<AresHubKpis> => {
      // Aggregate KPIs from multiple endpoints
      const [dqSummaryRes, annotationsRes] = await Promise.all([
        apiClient.get("/network/ares/dq-summary").catch(() => ({ data: { data: [] } })),
        apiClient.get("/network/ares/annotations").catch(() => ({ data: { data: [] } })),
      ]);

      const dqSummary = unwrap<Array<{ pass_rate: number; source_name: string }>>(dqSummaryRes.data) ?? [];
      const annotations = unwrap<unknown[]>(annotationsRes.data) ?? [];

      const sourceCount = dqSummary.length;
      const passRates = dqSummary
        .map((s) => s.pass_rate)
        .filter((r) => r > 0);
      const avgDqScore =
        passRates.length > 0
          ? passRates.reduce((a, b) => a + b, 0) / passRates.length
          : null;

      return {
        source_count: sourceCount,
        avg_dq_score: avgDqScore,
        total_unmapped_codes: 0, // Populated when network unmapped endpoint available
        annotation_count: annotations.length,
        latest_releases: [],
        sources_needing_attention: dqSummary.filter((s) => s.pass_rate < 80).length,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
