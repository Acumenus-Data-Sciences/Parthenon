import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FormInput } from "../FormInput";

describe("FormInput snapshots (dark clinical theme)", () => {
  it("renders an empty input with a label", () => {
    const { container } = render(
      <FormInput label="Email" placeholder="you@example.com" />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="form-group"
      >
        <label
          class="form-label"
          for="email"
        >
          Email
        </label>
        <div
          class="relative"
        >
          <input
            aria-invalid="false"
            class="form-input"
            id="email"
            placeholder="you@example.com"
          />
        </div>
      </div>
    `);
    expect(container.innerHTML).toMatch(/form-input/);
    expect(container.innerHTML).toMatch(/form-label/);
  });

  it("renders an input with a helper message", () => {
    const { container } = render(
      <FormInput label="Name" helper="Enter your full name" />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="form-group"
      >
        <label
          class="form-label"
          for="name"
        >
          Name
        </label>
        <div
          class="relative"
        >
          <input
            aria-describedby="name-helper"
            aria-invalid="false"
            class="form-input"
            id="name"
          />
        </div>
        <p
          class="form-helper"
          id="name-helper"
        >
          Enter your full name
        </p>
      </div>
    `);
    expect(container.innerHTML).toMatch(/form-helper/);
  });

  it("renders an input in the error state with the crimson token", () => {
    const { container } = render(
      <FormInput label="Password" error="Too short" />,
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <div
        class="form-group"
      >
        <label
          class="form-label"
          for="password"
        >
          Password
        </label>
        <div
          class="relative"
        >
          <input
            aria-describedby="password-error"
            aria-invalid="true"
            class="form-input error"
            id="password"
          />
        </div>
        <p
          class="form-error"
          id="password-error"
          role="alert"
        >
          Too short
        </p>
      </div>
    `);
    expect(container.innerHTML).toMatch(/form-input error/);
    expect(container.innerHTML).toMatch(/form-error/);
  });
});
