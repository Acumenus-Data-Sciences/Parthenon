import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunStatusBadge } from "../components/aqueduct/templates/RunStatusBadge";
import type { TemplateRunStatus } from "../types/templates";

const cases: Array<{ status: TemplateRunStatus; expectClass: string }> = [
  { status: "pending", expectClass: "text-text-muted" },
  { status: "queued", expectClass: "text-info" },
  { status: "running", expectClass: "text-warning" },
  { status: "completed", expectClass: "text-success" },
  { status: "failed", expectClass: "text-critical" },
  { status: "cancelled", expectClass: "text-text-ghost" },
];

describe("RunStatusBadge", () => {
  for (const { status, expectClass } of cases) {
    it(`renders ${status} with the expected color class`, () => {
      render(<RunStatusBadge status={status} />);
      const el = screen.getByTestId(`run-status-${status}`);
      expect(el.className).toContain(expectClass);
    });
  }
});
