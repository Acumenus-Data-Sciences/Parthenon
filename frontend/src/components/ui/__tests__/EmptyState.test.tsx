import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No data found" />);
    expect(screen.getByText("No data found")).toBeInTheDocument();
  });

  it("renders message when provided", () => {
    render(
      <EmptyState
        title="No results"
        message="Try adjusting your search criteria"
      />,
    );
    expect(
      screen.getByText("Try adjusting your search criteria"),
    ).toBeInTheDocument();
  });

  it("does not render message when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector(".empty-message")).not.toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <EmptyState
        title="No items"
        icon={<span data-testid="empty-icon">O</span>}
      />,
    );
    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(
      <EmptyState
        title="No items"
        action={<button>Create New</button>}
      />,
    );
    expect(screen.getByText("Create New")).toBeInTheDocument();
  });
});
