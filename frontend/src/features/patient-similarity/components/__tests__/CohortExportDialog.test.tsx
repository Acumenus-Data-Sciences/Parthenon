import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { CohortExportDialog } from "../CohortExportDialog";

const mutate = vi.fn();
const reset = vi.fn();

vi.mock("../../hooks/usePatientSimilarity", () => ({
  useExportCohort: () => ({
    mutate,
    reset,
    isPending: false,
    isError: false,
  }),
}));

describe("CohortExportDialog", () => {
  beforeEach(() => {
    mutate.mockReset();
    reset.mockReset();
  });

  it("submits cohort_description in the export payload", () => {
    renderWithProviders(
      <CohortExportDialog
        isOpen
        onClose={vi.fn()}
        cacheId={42}
        patients={[
          {
            person_id: 101,
            overall_score: 0.81,
            dimension_scores: {
              demographics: 0.7,
              conditions: 0.8,
              measurements: 0.9,
              drugs: 0.4,
              procedures: 0.3,
              genomics: null,
            },
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Similar to Patient 12345"), {
      target: { value: "High Similarity Cohort" },
    });
    fireEvent.change(screen.getByPlaceholderText("Optional description..."), {
      target: { value: "Exported from patient similarity." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Export \(1\)/ }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        cache_id: 42,
        cohort_name: "High Similarity Cohort",
        cohort_description: "Exported from patient similarity.",
      }),
      expect.any(Object),
    );
  });
});
