import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { FinnGenEndpointBrowserPage } from "../pages/FinnGenEndpointBrowserPage";
import * as api from "../api";

vi.mock("../api");

describe("FinnGenEndpointBrowserPage — Generate CTA disablement for finland_only", () => {
  it("disables the Generate button for finland_only endpoints on a non-Finnish source (PANCREAS)", async () => {
    vi.spyOn(api, "fetchEndpoint").mockResolvedValue({
      id: 1,
      name: "FIN_TEST_ENDPOINT",
      longname: "Test endpoint",
      description: "test",
      tags: ["finngen-endpoint"],
      release: "df14",
      coverage_bucket: "PARTIAL",
      coverage_profile: "finland_only",
      coverage: { bucket: "PARTIAL", pct: 0.4, n_tokens_total: 10, n_tokens_resolved: 4 },
      level: 1,
      sex_restriction: null,
      include_endpoints: [],
      pre_conditions: null,
      conditions: null,
      source_codes: null,
      resolved_concepts: { condition_count: 0, drug_count: 0, source_concept_count: 0, truncated: false },
      generations: [],
      created_at: null,
      updated_at: null,
    } as never);

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <FinnGenEndpointBrowserPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const generateBtn = await screen.findByRole("button", { name: /generate/i });
    expect(generateBtn).toBeDisabled();
    expect(generateBtn.getAttribute("title") ?? "").toMatch(/requires Finnish CDM data/i);
  });
});
