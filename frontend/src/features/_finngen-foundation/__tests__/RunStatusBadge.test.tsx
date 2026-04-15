import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunStatusBadge } from "../components/RunStatusBadge";
import type { FinnGenRunStatus } from "../types";

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
});
