import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VocabularyPage from "../pages/VocabularyPage";

// Mock child components — they have their own complex data fetching
vi.mock("../components/VocabularySearchPanel", () => ({
  VocabularySearchPanel: ({
    onSelectConcept,
  }: {
    selectedConceptId: number | null;
    onSelectConcept: (id: number) => void;
  }) => (
    <div data-testid="vocabulary-search-panel">
      <button onClick={() => onSelectConcept(12345)}>Select concept</button>
    </div>
  ),
}));

vi.mock("../components/ConceptDetailPanel", () => ({
  ConceptDetailPanel: ({
    conceptId,
  }: {
    conceptId: number | null;
    onSelectConcept: (id: number) => void;
  }) => (
    <div data-testid="concept-detail-panel">
      {conceptId ? `Concept #${conceptId}` : "No concept selected"}
    </div>
  ),
}));

vi.mock("../components/SemanticSearchPanel", () => ({
  SemanticSearchPanel: ({
    onSelectConcept,
  }: {
    onSelectConcept: (id: number) => void;
  }) => (
    <div data-testid="semantic-search-panel">
      <button onClick={() => onSelectConcept(99999)}>
        Select semantic concept
      </button>
    </div>
  ),
}));

vi.mock("../components/HierarchyBrowserPanel", () => ({
  HierarchyBrowserPanel: ({
    onSelectConcept,
  }: {
    mode: "browse";
    onSelectConcept: (id: number) => void;
  }) => (
    <div data-testid="hierarchy-browser-panel">
      <button onClick={() => onSelectConcept(77777)}>Select hierarchy concept</button>
    </div>
  ),
}));

vi.mock("@/features/help", () => ({
  HelpButton: () => <button data-testid="help-button" />,
}));

function renderVocabularyPage(initialRoute = "/vocabulary") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <VocabularyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("VocabularyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title and description", () => {
    renderVocabularyPage();

    expect(screen.getByText("Vocabulary Browser")).toBeInTheDocument();
    expect(
      screen.getByText(
        /search, explore, and navigate the OMOP standardized vocabulary/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders keyword, semantic, and browse tabs", () => {
    renderVocabularyPage();

    expect(screen.getByText("Keyword Search")).toBeInTheDocument();
    expect(screen.getByText("Semantic Search")).toBeInTheDocument();
    expect(screen.getByText("Browse Hierarchy")).toBeInTheDocument();
  });

  it("shows keyword search panel by default", () => {
    renderVocabularyPage();

    expect(
      screen.getByTestId("vocabulary-search-panel"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("semantic-search-panel"),
    ).not.toBeInTheDocument();
  });

  it("switches to semantic search panel when tab is clicked", async () => {
    const user = userEvent.setup();
    renderVocabularyPage();

    await user.click(screen.getByText("Semantic Search"));

    expect(
      screen.getByTestId("semantic-search-panel"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("vocabulary-search-panel"),
    ).not.toBeInTheDocument();
  });

  it("switches to hierarchy browser when tab is clicked", async () => {
    const user = userEvent.setup();
    renderVocabularyPage();

    await user.click(screen.getByText("Browse Hierarchy"));

    expect(
      screen.getByTestId("hierarchy-browser-panel"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("vocabulary-search-panel"),
    ).not.toBeInTheDocument();
  });

  it("renders the concept detail panel", () => {
    renderVocabularyPage();

    expect(screen.getByTestId("concept-detail-panel")).toBeInTheDocument();
    expect(screen.getByText("No concept selected")).toBeInTheDocument();
  });

  it("passes selected concept to detail panel when a concept is chosen", async () => {
    const user = userEvent.setup();
    renderVocabularyPage();

    await user.click(screen.getByText("Select concept"));

    expect(screen.getByText("Concept #12345")).toBeInTheDocument();
  });

  it("passes selected concept from semantic search to detail panel", async () => {
    const user = userEvent.setup();
    renderVocabularyPage();

    // Switch to semantic tab
    await user.click(screen.getByText("Semantic Search"));
    await user.click(screen.getByText("Select semantic concept"));

    expect(screen.getByText("Concept #99999")).toBeInTheDocument();
  });

  it("passes selected concept from hierarchy browse to detail panel", async () => {
    const user = userEvent.setup();
    renderVocabularyPage();

    await user.click(screen.getByText("Browse Hierarchy"));
    await user.click(screen.getByText("Select hierarchy concept"));

    expect(screen.getByText("Concept #77777")).toBeInTheDocument();
  });
});
