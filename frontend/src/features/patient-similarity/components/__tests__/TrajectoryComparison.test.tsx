import { waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { fetchTemporalSimilarity } from "../../api/patientSimilarityApi";
import { TrajectoryComparison } from "../TrajectoryComparison";

vi.mock("../../api/patientSimilarityApi", () => ({
  fetchTemporalSimilarity: vi.fn(),
}));

const mockFetchTemporalSimilarity = vi.mocked(fetchTemporalSimilarity);

describe("TrajectoryComparison", () => {
  beforeEach(() => {
    mockFetchTemporalSimilarity.mockReset();
    mockFetchTemporalSimilarity.mockResolvedValue({
      overall_similarity: 0,
      per_measurement: [],
    });
  });

  it("calls temporal similarity with patient A, patient B, then source id", async () => {
    renderWithProviders(
      <TrajectoryComparison sourceId={7} personAId={101} personBId={202} />,
    );

    await waitFor(() => {
      expect(mockFetchTemporalSimilarity).toHaveBeenCalledWith(101, 202, 7);
    });
  });
});
