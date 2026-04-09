import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FilterChip } from "../FilterChip";

describe("FilterChip snapshots (dark clinical theme)", () => {
  it("renders an inactive chip", () => {
    const { container } = render(<FilterChip label="SNOMED" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="filter-chip"
        type="button"
      >
        SNOMED
      </button>
    `);
    expect(container.innerHTML).toMatch(/filter-chip/);
    expect(container.innerHTML).not.toMatch(/filter-chip active/);
  });

  it("renders an active chip with remove affordance", () => {
    const { container } = render(
      <FilterChip label="SNOMED" active onRemove={() => {}} />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <button
        class="filter-chip active"
        type="button"
      >
        SNOMED
        <span
          aria-label="Remove SNOMED"
          class="chip-close"
          role="button"
        >
          <svg
            aria-hidden="true"
            class="lucide lucide-x"
            fill="none"
            height="12"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            viewBox="0 0 24 24"
            width="12"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M18 6 6 18"
            />
            <path
              d="m6 6 12 12"
            />
          </svg>
        </span>
      </button>
    `);
    expect(container.innerHTML).toMatch(/filter-chip active/);
    expect(container.innerHTML).toMatch(/chip-close/);
  });
});
