import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatusDot } from "../StatusDot";

describe("StatusDot snapshots (dark clinical theme)", () => {
  it("renders the healthy status (green/teal)", () => {
    const { container } = render(<StatusDot status="healthy" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        aria-label="healthy"
        class="status-dot healthy"
        role="img"
      />
    `);
    expect(container.innerHTML).toMatch(/status-dot healthy/);
  });

  it("renders the warning status (gold)", () => {
    const { container } = render(<StatusDot status="warning" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        aria-label="warning"
        class="status-dot warning"
        role="img"
      />
    `);
    expect(container.innerHTML).toMatch(/status-dot warning/);
  });

  it("renders the critical status (crimson)", () => {
    const { container } = render(<StatusDot status="critical" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        aria-label="critical"
        class="status-dot critical"
        role="img"
      />
    `);
    expect(container.innerHTML).toMatch(/status-dot critical/);
  });

  it("renders the unknown status", () => {
    const { container } = render(<StatusDot status="unknown" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        aria-label="unknown"
        class="status-dot unknown"
        role="img"
      />
    `);
    expect(container.innerHTML).toMatch(/status-dot unknown/);
  });
});
