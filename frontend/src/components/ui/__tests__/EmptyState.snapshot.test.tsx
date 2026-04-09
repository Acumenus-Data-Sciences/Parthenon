import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { EmptyState } from "../EmptyState";

describe("EmptyState snapshots (dark clinical theme)", () => {
  it("renders title only", () => {
    const { container } = render(<EmptyState title="No data" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="empty-state"
      >
        <h3
          class="empty-title"
        >
          No data
        </h3>
      </div>
    `);
    expect(container.innerHTML).toMatch(/empty-state/);
  });

  it("renders icon + title + message + action", () => {
    const { container } = render(
      <EmptyState
        icon={<span data-testid="icon">!</span>}
        title="No cohorts"
        message="Create a cohort to get started"
        action={<button className="btn btn-primary">Create cohort</button>}
      />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="empty-state"
      >
        <div
          class="empty-icon"
        >
          <span
            data-testid="icon"
          >
            !
          </span>
        </div>
        <h3
          class="empty-title"
        >
          No cohorts
        </h3>
        <p
          class="empty-message"
        >
          Create a cohort to get started
        </p>
        <button
          class="btn btn-primary"
        >
          Create cohort
        </button>
      </div>
    `);
    expect(container.innerHTML).toMatch(/empty-icon/);
    expect(container.innerHTML).toMatch(/empty-message/);
    expect(container.innerHTML).toMatch(/btn-primary/);
  });
});
