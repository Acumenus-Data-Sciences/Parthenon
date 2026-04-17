import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoverageProfileBadge } from "../components/CoverageProfileBadge";

describe("CoverageProfileBadge", () => {
  it("renders 'Requires Finnish CDM' for finland_only profile", () => {
    render(<CoverageProfileBadge profile="finland_only" />);
    expect(screen.getByText(/Requires Finnish CDM/i)).toBeInTheDocument();
  });

  it("renders a 'Partial coverage' label for partial profile", () => {
    render(<CoverageProfileBadge profile="partial" />);
    expect(screen.getByText(/Partial coverage/i)).toBeInTheDocument();
  });

  it("renders nothing visible for universal profile (universal is the happy path)", () => {
    const { container } = render(<CoverageProfileBadge profile="universal" />);
    // Either nothing or a quiet 'Universal' label — Plan 07 picks. For RED,
    // assert the badge does NOT render the finland_only copy.
    expect(container.textContent ?? "").not.toMatch(/Requires Finnish CDM/i);
  });
});
