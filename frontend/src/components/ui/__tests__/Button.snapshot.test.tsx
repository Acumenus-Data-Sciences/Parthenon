import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "../Button";

describe("Button snapshots (dark clinical theme)", () => {
  it("renders the primary variant", () => {
    const { container } = render(<Button variant="primary">Save</Button>);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="btn btn-primary"
      >
        Save
      </button>
    `);
    expect(container.innerHTML).toMatch(/btn-primary/);
  });

  it("renders the secondary variant (default)", () => {
    const { container } = render(<Button>Cancel</Button>);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="btn btn-secondary"
      >
        Cancel
      </button>
    `);
    expect(container.innerHTML).toMatch(/btn-secondary/);
  });

  it("renders the danger variant with the crimson token", () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="btn btn-danger"
      >
        Delete
      </button>
    `);
    expect(container.innerHTML).toMatch(/btn-danger/);
  });

  it("renders the ghost variant at small size", () => {
    const { container } = render(
      <Button variant="ghost" size="sm">
        Close
      </Button>,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="btn btn-ghost btn-sm"
      >
        Close
      </button>
    `);
    expect(container.innerHTML).toMatch(/btn-ghost/);
    expect(container.innerHTML).toMatch(/btn-sm/);
  });

  it("renders a disabled primary button", () => {
    const { container } = render(
      <Button variant="primary" disabled>
        Submit
      </Button>,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="btn btn-primary"
        disabled=""
      >
        Submit
      </button>
    `);
    expect(container.innerHTML).toMatch(/disabled/);
  });
});
