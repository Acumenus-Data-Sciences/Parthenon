import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Panel } from "../Panel";

describe("Panel snapshots (dark clinical theme)", () => {
  it("renders with header + body", () => {
    const { container } = render(
      <Panel header={<span>Section title</span>}>Body content</Panel>,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="panel"
      >
        <div
          class="panel-header"
        >
          <span>
            Section title
          </span>
        </div>
        <div
          class="panel-body"
        >
          Body content
        </div>
      </div>
    `);
    expect(container.innerHTML).toMatch(/panel-header/);
    expect(container.innerHTML).toMatch(/panel-body/);
  });

  it("renders with header + body + footer (inset variant)", () => {
    const { container } = render(
      <Panel
        variant="inset"
        header={<span>Header</span>}
        footer={<span>Footer</span>}
      >
        Body
      </Panel>,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="panel panel-inset"
      >
        <div
          class="panel-header"
        >
          <span>
            Header
          </span>
        </div>
        <div
          class="panel-body"
        >
          Body
        </div>
        <div
          class="panel-footer"
        >
          <span>
            Footer
          </span>
        </div>
      </div>
    `);
    expect(container.innerHTML).toMatch(/panel-inset/);
    expect(container.innerHTML).toMatch(/panel-footer/);
  });
});
