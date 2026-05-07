import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidateCard } from "../components/CandidateCard";
import type { CandidateDetail } from "../types";

function makeCandidate(overrides: Partial<CandidateDetail> = {}): CandidateDetail {
  return {
    concept_id: 4193704,
    concept_name: "Glucose [Mass/volume] in Serum or Plasma",
    vocabulary_id: "LOINC",
    domain_id: "Measurement",
    concept_class_id: "Lab Test",
    standard_concept: "S",
    similarity: 0.91,
    rerank_score: 0.95,
    rerank_rationale: "Exact match: serum glucose by mass per volume.",
    concept_still_valid: true,
    ...overrides,
  };
}

describe("CandidateCard", () => {
  it("renders the concept name, vocabulary, and domain badges", () => {
    render(
      <CandidateCard
        candidate={makeCandidate()}
        rank={1}
        isFocused={false}
        busy={false}
        onApprove={() => {}}
      />,
    );
    expect(
      screen.getByText("Glucose [Mass/volume] in Serum or Plasma"),
    ).toBeInTheDocument();
    expect(screen.getByText("LOINC")).toBeInTheDocument();
    expect(screen.getByText("Measurement")).toBeInTheDocument();
  });

  it("renders the rerank rationale when present", () => {
    render(
      <CandidateCard
        candidate={makeCandidate()}
        rank={1}
        isFocused
        busy={false}
        onApprove={() => {}}
      />,
    );
    expect(
      screen.getByText("Exact match: serum glucose by mass per volume."),
    ).toBeInTheDocument();
  });

  it("calls onApprove with concept_id when the approve button is clicked", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(
      <CandidateCard
        candidate={makeCandidate()}
        rank={1}
        isFocused
        busy={false}
        onApprove={onApprove}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledWith(4193704);
  });

  it("disables Approve and shows the warning when concept_still_valid is false", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ concept_still_valid: false })}
        rank={1}
        isFocused
        busy={false}
        onApprove={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/retired or invalidated/i);
  });

  it("flags non-standard concepts visibly", () => {
    render(
      <CandidateCard
        candidate={makeCandidate({ standard_concept: null })}
        rank={1}
        isFocused
        busy={false}
        onApprove={() => {}}
      />,
    );
    expect(screen.getByText("Non-standard")).toBeInTheDocument();
  });

  it("disables Approve while busy", () => {
    render(
      <CandidateCard
        candidate={makeCandidate()}
        rank={1}
        isFocused
        busy
        onApprove={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  });
});
