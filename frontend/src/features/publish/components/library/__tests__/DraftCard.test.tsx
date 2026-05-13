import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DraftCard } from "../DraftCard";
import type { PublicationDraft } from "../../../types/publish";

const draft: PublicationDraft = {
  id: 7,
  user_id: 1,
  study_id: 42,
  title: "Hypertension Cohort Analysis",
  template: "generic-ohdsi",
  document_json: {
    version: 1,
    title: "Hypertension Cohort Analysis",
    authors: [],
    template: "generic-ohdsi",
    step: 2,
    selectedExecutions: [],
    sections: [
      { id: "1", type: "results", title: "x", content: "", included: true, tableIncluded: true },
      { id: "2", type: "results", title: "y", content: "", included: true, diagramIncluded: true },
    ],
  },
  status: "draft",
  last_opened_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("DraftCard", () => {
  it("renders the title, template, and section counts", () => {
    render(
      <MemoryRouter>
        <DraftCard draft={draft} onArchive={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()} onRename={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Hypertension Cohort Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/generic-ohdsi/i)).toBeInTheDocument();
    expect(screen.getByText(/2 sections/i)).toBeInTheDocument();
    expect(screen.getByText(/1 table/i)).toBeInTheDocument();
    expect(screen.getByText(/1 figure/i)).toBeInTheDocument();
  });

  it("links to /publish/library/:id", () => {
    render(
      <MemoryRouter>
        <DraftCard draft={draft} onArchive={vi.fn()} onDelete={vi.fn()} onDuplicate={vi.fn()} onRename={vi.fn()} />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /Open draft/i });
    expect(link.getAttribute("href")).toBe("/publish/library/7");
  });

  it("fires onArchive when archive menu item clicked", () => {
    const onArchive = vi.fn();
    render(
      <MemoryRouter>
        <DraftCard draft={draft} onArchive={onArchive} onDelete={vi.fn()} onDuplicate={vi.fn()} onRename={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText(/More actions/i));
    fireEvent.click(screen.getByText(/Archive/i));
    expect(onArchive).toHaveBeenCalledWith(7);
  });
});
