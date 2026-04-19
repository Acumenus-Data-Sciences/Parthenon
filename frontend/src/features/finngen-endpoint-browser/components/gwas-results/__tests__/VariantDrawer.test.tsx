// Phase 16 Plan 05 Task 2 — VariantDrawer tests (D-12).
//
// Covers: null → returns null (no render); non-null → all 10 fields shown
// with correct formatting (AF 4 decimals, β/SE 3 decimals, P exponential
// or <1e-300 floor); onClose fires on close button; runIdTail uses last 6
// characters in mono-font with full id in title attribute.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariantDrawer } from "../VariantDrawer";
import type { TopVariantRow } from "../../../api/gwas-results";

const baseVariant: TopVariantRow = {
  chrom: "17",
  pos: 43_500_000,
  ref: "A",
  alt: "T",
  af: 0.1234,
  beta: 0.0567,
  se: 0.0123,
  p_value: 3.4e-12,
  snp_id: "rs987654",
  gwas_run_id: "01JABCDEFGHIJKLMNOPQRS123456",
};

describe("VariantDrawer", () => {
  it("returns null when variant prop is null", () => {
    const { container } = render(
      <VariantDrawer variant={null} onClose={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders as a role=dialog with aria-modal=true", () => {
    render(
      <VariantDrawer variant={baseVariant} onClose={() => undefined} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Variant detail");
  });

  it("renders all 10 D-12 fields with correct formatting", () => {
    render(
      <VariantDrawer variant={baseVariant} onClose={() => undefined} />,
    );
    expect(screen.getByTestId("drawer-chrom")).toHaveTextContent("17");
    expect(screen.getByTestId("drawer-pos")).toHaveTextContent("43,500,000");
    expect(screen.getByTestId("drawer-ref")).toHaveTextContent("A");
    expect(screen.getByTestId("drawer-alt")).toHaveTextContent("T");
    expect(screen.getByTestId("drawer-af")).toHaveTextContent("0.1234");
    expect(screen.getByTestId("drawer-beta")).toHaveTextContent("0.057");
    expect(screen.getByTestId("drawer-se")).toHaveTextContent("0.012");
    expect(screen.getByTestId("drawer-p")).toHaveTextContent("3.40e-12");
    expect(screen.getByTestId("drawer-snp")).toHaveTextContent("rs987654");
  });

  it("renders the <1e-300 floor sentinel when p_value is sub-floor", () => {
    render(
      <VariantDrawer
        variant={{ ...baseVariant, p_value: 1e-400 }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId("drawer-p")).toHaveTextContent("<1e-300");
  });

  it("falls back to em-dash when snp_id is null", () => {
    render(
      <VariantDrawer
        variant={{ ...baseVariant, snp_id: null }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId("drawer-snp")).toHaveTextContent("\u2014");
  });

  it("shows the last 6 characters of gwas_run_id with the full id as title", () => {
    render(
      <VariantDrawer variant={baseVariant} onClose={() => undefined} />,
    );
    const runEl = screen.getByTestId("drawer-run");
    // "01JABCDEFGHIJKLMNOPQRS123456".slice(-6) = "123456"
    expect(runEl).toHaveTextContent("\u2026123456");
    expect(runEl).toHaveAttribute("title", baseVariant.gwas_run_id);
  });

  it("fires onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<VariantDrawer variant={baseVariant} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close drawer/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("tolerates null numeric fields (af/beta/se) by rendering 0 formatted", () => {
    render(
      <VariantDrawer
        variant={{ ...baseVariant, af: null, beta: null, se: null }}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId("drawer-af")).toHaveTextContent("0.0000");
    expect(screen.getByTestId("drawer-beta")).toHaveTextContent("0.000");
    expect(screen.getByTestId("drawer-se")).toHaveTextContent("0.000");
  });
});
