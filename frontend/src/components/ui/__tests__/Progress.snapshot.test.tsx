import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Progress } from "../Progress";

describe("Progress snapshots (dark clinical theme)", () => {
  it("renders at 0%", () => {
    const { container } = render(<Progress value={0} label="Upload" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        aria-label="Upload"
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow="0"
        class="progress-track"
        role="progressbar"
      >
        <div
          class="progress-fill"
          style="width: 0%;"
        />
      </div>
    `);
    expect(container.innerHTML).toMatch(/progress-track/);
    expect(container.innerHTML).toMatch(/width: 0%/);
  });

  it("renders at 50% with the primary variant (teal fill)", () => {
    const { container } = render(
      <Progress value={50} variant="primary" label="Sync" />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        aria-label="Sync"
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow="50"
        class="progress-track"
        role="progressbar"
      >
        <div
          class="progress-fill primary"
          style="width: 50%;"
        />
      </div>
    `);
    expect(container.innerHTML).toMatch(/progress-fill primary/);
    expect(container.innerHTML).toMatch(/width: 50%/);
  });

  it("renders at 100% with the success variant", () => {
    const { container } = render(
      <Progress value={100} variant="success" label="Done" />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        aria-label="Done"
        aria-valuemax="100"
        aria-valuemin="0"
        aria-valuenow="100"
        class="progress-track"
        role="progressbar"
      >
        <div
          class="progress-fill success"
          style="width: 100%;"
        />
      </div>
    `);
    expect(container.innerHTML).toMatch(/progress-fill success/);
    expect(container.innerHTML).toMatch(/width: 100%/);
  });
});
