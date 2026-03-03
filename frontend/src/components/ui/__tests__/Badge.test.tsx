import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant class", () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass("badge", "badge-default");
  });

  it("applies specified variant class", () => {
    const { container } = render(<Badge variant="critical">Error</Badge>);
    expect(container.firstChild).toHaveClass("badge-critical");
  });

  it("renders icon when provided", () => {
    render(
      <Badge icon={<span data-testid="icon">!</span>}>Warning</Badge>,
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("passes through additional HTML attributes", () => {
    render(<Badge data-testid="my-badge">Test</Badge>);
    expect(screen.getByTestId("my-badge")).toBeInTheDocument();
  });
});
