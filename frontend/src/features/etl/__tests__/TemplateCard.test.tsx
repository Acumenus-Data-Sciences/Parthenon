import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateCard } from "../components/aqueduct/templates/TemplateCard";

const sample = {
  id: "hello_cdm",
  name: "Hello CDM",
  description: "Bootstrap an empty OMOP CDM v5.4 schema",
  category: "bootstrap" as const,
  tags: ["foundation", "smoke"],
  cdm_versions: ["5.3", "5.4"],
};

describe("TemplateCard", () => {
  it("renders name, description, tags, and CDM pills", () => {
    render(<TemplateCard {...sample} onSelect={vi.fn()} />);
    expect(screen.getByText("Hello CDM")).toBeInTheDocument();
    expect(
      screen.getByText("Bootstrap an empty OMOP CDM v5.4 schema"),
    ).toBeInTheDocument();
    expect(screen.getByText("foundation")).toBeInTheDocument();
    expect(screen.getByText("smoke")).toBeInTheDocument();
    expect(screen.getByText("CDM 5.3")).toBeInTheDocument();
    expect(screen.getByText("CDM 5.4")).toBeInTheDocument();
  });

  it("invokes onSelect with the template id when clicked", () => {
    const onSelect = vi.fn();
    render(<TemplateCard {...sample} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Hello CDM/ }));
    expect(onSelect).toHaveBeenCalledWith("hello_cdm");
  });

  it("is keyboard-activatable (Enter)", () => {
    const onSelect = vi.fn();
    render(<TemplateCard {...sample} onSelect={onSelect} />);
    const btn = screen.getByRole("button", { name: /Hello CDM/ });
    btn.focus();
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("hello_cdm");
  });
});
