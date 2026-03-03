import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusDot } from "../StatusDot";

describe("StatusDot", () => {
  it("renders with status class", () => {
    const { container } = render(<StatusDot status="healthy" />);
    expect(container.firstChild).toHaveClass("status-dot", "healthy");
  });

  it("uses status as default aria-label", () => {
    render(<StatusDot status="critical" />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "critical");
  });

  it("uses custom label for aria-label", () => {
    render(<StatusDot status="active" label="Service is active" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Service is active",
    );
  });

  it("applies all status variants", () => {
    const variants = [
      "healthy",
      "success",
      "warning",
      "critical",
      "running",
      "inactive",
      "queued",
    ] as const;

    for (const status of variants) {
      const { container, unmount } = render(<StatusDot status={status} />);
      expect(container.firstChild).toHaveClass(status);
      unmount();
    }
  });
});
