import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";
import { ConceptSetItemRow } from "../ConceptSetItemRow";
import type { ConceptSetItem } from "../../types/conceptSet";

function makeItem(overrides: Partial<ConceptSetItem> = {}): ConceptSetItem {
  return {
    id: 1,
    concept_set_id: 10,
    concept_id: 201820,
    is_excluded: false,
    include_descendants: true,
    include_mapped: false,
    concept: {
      concept_id: 201820,
      concept_name: "Diabetes mellitus",
      domain_id: "Condition",
      vocabulary_id: "SNOMED",
      concept_class_id: "Clinical Finding",
      standard_concept: "S",
      concept_code: "73211009",
    },
    ...overrides,
  };
}

function renderInTable(row: ReactElement) {
  return render(
    <table>
      <tbody>{row}</tbody>
    </table>,
  );
}

describe("ConceptSetItemRow", () => {
  it("renders concept id, name, domain, and vocabulary", () => {
    renderInTable(
      <ConceptSetItemRow
        item={makeItem()}
        index={0}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        isUpdating={false}
        isRemoving={false}
      />,
    );
    expect(screen.getByText("201820")).toBeInTheDocument();
    expect(screen.getByText("Diabetes mellitus")).toBeInTheDocument();
    expect(screen.getByText("Condition")).toBeInTheDocument();
    expect(screen.getByText("SNOMED")).toBeInTheDocument();
  });

  it("renders three toggle switches (excluded, descendants, mapped)", () => {
    renderInTable(
      <ConceptSetItemRow
        item={makeItem()}
        index={0}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        isUpdating={false}
        isRemoving={false}
      />,
    );
    expect(screen.getByRole("switch", { name: "Exclude concept" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Include descendants" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Include mapped" })).toBeInTheDocument();
  });

  it("calls onToggle with the correct field when a switch is clicked", () => {
    const onToggle = vi.fn();
    renderInTable(
      <ConceptSetItemRow
        item={makeItem()}
        index={0}
        onToggle={onToggle}
        onRemove={vi.fn()}
        isUpdating={false}
        isRemoving={false}
      />,
    );
    fireEvent.click(screen.getByRole("switch", { name: "Exclude concept" }));
    expect(onToggle).toHaveBeenCalledWith(1, "is_excluded", true);
  });

  it("calls onRemove with the item id when the delete button is clicked", () => {
    const onRemove = vi.fn();
    renderInTable(
      <ConceptSetItemRow
        item={makeItem({ id: 42 })}
        index={0}
        onToggle={vi.fn()}
        onRemove={onRemove}
        isUpdating={false}
        isRemoving={false}
      />,
    );
    fireEvent.click(screen.getByTitle("Remove item"));
    expect(onRemove).toHaveBeenCalledWith(42);
  });

  it("renders the Standard badge when the concept is a standard concept", () => {
    renderInTable(
      <ConceptSetItemRow
        item={makeItem()}
        index={0}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        isUpdating={false}
        isRemoving={false}
      />,
    );
    expect(screen.getByText("Standard")).toBeInTheDocument();
  });

  it("calls onSelectionChange with the item id when the row checkbox is clicked", () => {
    const onSelectionChange = vi.fn();
    renderInTable(
      <ConceptSetItemRow
        item={makeItem({ id: 7 })}
        index={0}
        isSelected={false}
        onSelectionChange={onSelectionChange}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        isUpdating={false}
        isRemoving={false}
      />,
    );
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(onSelectionChange).toHaveBeenCalledWith(7);
  });
});
