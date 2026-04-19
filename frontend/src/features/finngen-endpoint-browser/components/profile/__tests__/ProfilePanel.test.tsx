// Phase 18 (Plan 18-06) — ProfilePanel real assertions (GREEN flip).
// Mocks the read + dispatch hooks so the test exercises the orchestration
// logic (auto-dispatch on needs_compute, sub-panel rendering on cached,
// error banner on ineligible, back-breadcrumb when priorEndpointName set).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { ProfilePanel } from "../ProfilePanel";
import type { EndpointProfileEnvelope } from "../../../api";

// Mocks for the two TanStack Query hooks ProfilePanel consumes.
const mockUseEndpointProfile = vi.fn();
const mockMutate = vi.fn();
const mockUseDispatchEndpointProfile = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
}));

vi.mock("../../../hooks/useEndpointProfile", () => ({
  useEndpointProfile: (
    ...args: Parameters<typeof mockUseEndpointProfile>
  ) => mockUseEndpointProfile(...args),
  PROFILE_POLL_INTERVAL_MS: 3000,
}));

vi.mock("../../../hooks/useDispatchEndpointProfile", () => ({
  useDispatchEndpointProfile: (
    ...args: Parameters<typeof mockUseDispatchEndpointProfile>
  ) => mockUseDispatchEndpointProfile(...args),
}));

const CACHED_ENVELOPE: EndpointProfileEnvelope = {
  status: "cached",
  summary: {
    endpoint_name: "E4_DM2",
    source_key: "PANCREAS",
    expression_hash: "abc",
    subject_count: 1000,
    death_count: 142,
    median_survival_days: 1500,
    age_at_death_mean: 68,
    age_at_death_median: 70,
    age_at_death_bins: [{ bin_start: 65, bin_end: 69, count: 25 }],
    computed_at: "2026-04-19T12:00:00Z",
    run_id: "01HFAKE",
  },
  km_points: [
    { time_days: 30, survival_prob: 0.97, at_risk: 950, events: 30 },
  ],
  comorbidities: [
    {
      comorbid_endpoint_name: "I9_HTN",
      comorbid_endpoint_display_name: "Hypertension",
      phi_coef: 0.42,
      odds_ratio: 3.1,
      or_ci_low: 2.6,
      or_ci_high: 3.7,
      co_count: 250,
      rank: 1,
    },
  ],
  drug_classes: [
    {
      atc3_code: "C09",
      atc3_name: "C09: agents acting on the RAAS",
      subjects_on_drug: 384,
      subjects_total: 1000,
      pct_on_drug: 38.4,
      rank: 1,
    },
  ],
  meta: {
    universe_size: 120,
    min_subjects: 20,
    source_has_death_data: true,
    source_has_drug_data: true,
  },
};

describe("ProfilePanel", () => {
  beforeEach(() => {
    mockUseEndpointProfile.mockReset();
    mockMutate.mockReset();
    mockUseDispatchEndpointProfile.mockClear();
    mockUseDispatchEndpointProfile.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  it("renders the 3 sub-panels when envelope.status === 'cached'", () => {
    mockUseEndpointProfile.mockReturnValue({
      data: CACHED_ENVELOPE,
      isLoading: false,
    });
    renderWithProviders(
      <ProfilePanel
        endpointName="E4_DM2"
        endpointDisplayName="Type 2 diabetes"
        sourceKey="PANCREAS"
      />,
    );
    expect(screen.getByText("Survival")).toBeTruthy();
    expect(screen.getByText("Comorbidities")).toBeTruthy();
    expect(screen.getByText("Drug classes (90d pre-index)")).toBeTruthy();
  });

  it("auto-dispatches compute when envelope.status === 'needs_compute'", () => {
    mockUseEndpointProfile.mockReturnValue({
      data: {
        status: "needs_compute",
        reason: "no_cache",
        dispatch_url:
          "/api/v1/finngen/endpoints/E4_DM2/profile",
      } satisfies EndpointProfileEnvelope,
      isLoading: false,
    });
    renderWithProviders(
      <ProfilePanel
        endpointName="E4_DM2"
        endpointDisplayName="Type 2 diabetes"
        sourceKey="PANCREAS"
      />,
    );
    expect(mockMutate).toHaveBeenCalledWith({
      source_key: "PANCREAS",
      min_subjects: 20,
    });
  });

  it("renders single error banner when envelope.status === 'ineligible'", () => {
    mockUseEndpointProfile.mockReturnValue({
      data: {
        status: "ineligible",
        error_code: "source_ineligible",
        message: "Source has no death data",
      } satisfies EndpointProfileEnvelope,
      isLoading: false,
    });
    renderWithProviders(
      <ProfilePanel
        endpointName="E4_DM2"
        endpointDisplayName="Type 2 diabetes"
        sourceKey="PANCREAS"
      />,
    );
    // The error_code → copy mapping per UI-SPEC §Error states.
    expect(
      screen.getByText(
        /This source has no death or observation-period data\. Endpoint profile cannot be computed\./,
      ),
    ).toBeTruthy();
    // No sub-panels rendered.
    expect(screen.queryByText("Survival")).toBeNull();
    expect(screen.queryByText("Comorbidities")).toBeNull();
  });

  it("renders back-breadcrumb when priorEndpointName is set", () => {
    mockUseEndpointProfile.mockReturnValue({
      data: CACHED_ENVELOPE,
      isLoading: false,
    });
    // Use a display name that doesn't collide with the cached envelope's
    // comorbidity row label ("Hypertension").
    renderWithProviders(
      <ProfilePanel
        endpointName="E4_DM2"
        endpointDisplayName="Type 2 diabetes"
        sourceKey="PANCREAS"
        priorEndpointName="C3_BREAST_PRIOR"
        priorEndpointDisplayName="Breast cancer (prior)"
      />,
    );
    expect(screen.getByText("Breast cancer (prior)")).toBeTruthy();
  });

  it("uses aria-live='polite' on the container for screen-reader announcements", () => {
    mockUseEndpointProfile.mockReturnValue({
      data: CACHED_ENVELOPE,
      isLoading: false,
    });
    const { container } = renderWithProviders(
      <ProfilePanel
        endpointName="E4_DM2"
        endpointDisplayName="Type 2 diabetes"
        sourceKey="PANCREAS"
      />,
    );
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });
});
