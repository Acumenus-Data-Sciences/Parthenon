import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "../Badge";

describe("Badge snapshots (dark clinical theme)", () => {
  it("renders the default variant", () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        class="badge badge-default"
      >
        Default
      </span>
    `);
    expect(container.innerHTML).toMatch(/badge-default/);
  });

  it("renders the success variant with the success token", () => {
    const { container } = render(<Badge variant="success">Ok</Badge>);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        class="badge badge-success"
      >
        Ok
      </span>
    `);
    expect(container.innerHTML).toMatch(/badge-success/);
  });

  it("renders the warning variant with the warning token", () => {
    const { container } = render(<Badge variant="warning">Warn</Badge>);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        class="badge badge-warning"
      >
        Warn
      </span>
    `);
    expect(container.innerHTML).toMatch(/badge-warning/);
  });

  it("renders the critical variant with the crimson token", () => {
    const { container } = render(<Badge variant="critical">Error</Badge>);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        class="badge badge-critical"
      >
        Error
      </span>
    `);
    expect(container.innerHTML).toMatch(/badge-critical/);
  });

  it("renders the info variant with the info token", () => {
    const { container } = render(<Badge variant="info">Info</Badge>);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        class="badge badge-info"
      >
        Info
      </span>
    `);
    expect(container.innerHTML).toMatch(/badge-info/);
  });
});
