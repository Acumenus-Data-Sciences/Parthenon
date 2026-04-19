import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunStatusBadge } from "../components/RunStatusBadge";
import type { FinnGenRunStatus } from "../types";

// Phase 15: 'superseded' is the new terminal state for overwritten GWAS tracking
// rows. It is not part of FinnGenRunStatus (which covers raw finngen.runs only);
// the badge widens its accepted status to include it via a local type union.
const ALL_STATUSES: FinnGenRunStatus[] = [
  "queued",
  "running",
  "canceling",
  "succeeded",
  "failed",
  "canceled",
];

describe("RunStatusBadge", () => {
  it.each(ALL_STATUSES)("renders status %s with a data-testid", (status) => {
    render(<RunStatusBadge status={status} />);
    expect(screen.getByTestId(`finngen-run-status-${status}`)).toBeInTheDocument();
  });

  it("accepts a custom className", () => {
    const { container } = render(<RunStatusBadge status="running" className="my-extra" />);
    const el = container.querySelector(".my-extra");
    expect(el).toBeTruthy();
  });

  // Phase 15 additions — 'superseded' status + font-semibold (2-weight contract).
  it("renders the superseded status (Phase 15)", () => {
    render(<RunStatusBadge status="superseded" />);
    const el = screen.getByTestId("finngen-run-status-superseded");
    expect(el).toBeInTheDocument();
    // UI-SPEC §Color status-pill map: zinc-muted tones.
    expect(el.className).toContain("border-zinc-700/40");
    expect(el.className).toContain("bg-zinc-900/40");
    expect(el.className).toContain("text-zinc-500");
  });

  it("uses font-semibold (Phase 15 2-weight typography contract)", () => {
    render(<RunStatusBadge status="queued" />);
    const el = screen.getByTestId("finngen-run-status-queued");
    expect(el.className).toContain("font-semibold");
    expect(el.className).not.toContain("font-medium");
  });
});
