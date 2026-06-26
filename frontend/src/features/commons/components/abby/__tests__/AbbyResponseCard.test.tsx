import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AbbyResponseCard from "../AbbyResponseCard";
import type { AbbyMessage, AbbySource } from "../../../types/abby";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

const message: AbbyMessage = {
  id: "abby-message-1",
  channel_id: "commons-general",
  user_id: "abby-system-user",
  body: "This answer cites a source.",
  object_references: [],
  created_at: "2026-06-18T12:00:00Z",
  metadata: {
    is_ai_generated: true,
    model: "MedGemma1.5:4b",
    sources: [],
  },
};

function renderCard(sources: AbbySource[]) {
  return render(
    <MemoryRouter initialEntries={["/commons/general"]}>
      <AbbyResponseCard
        message={{ ...message, metadata: { ...message.metadata, sources } }}
        sources={sources}
        objectReferences={[]}
      />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("AbbyResponseCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("navigates source cards to known internal source artifacts", async () => {
    const user = userEvent.setup();

    renderCard([
      {
        collection: "data_source",
        label: "Data source",
        title: "Eunomia CDM",
        document_id: "17",
      },
    ]);

    await user.click(screen.getByRole("button", { name: /1 source/i }));
    await user.click(screen.getByRole("button", { name: /Eunomia CDM/i }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/data-explorer/17",
    );
  });

  it("renders no route badge for legacy responses without routing", () => {
    renderCard([]);
    expect(screen.queryByTestId("abby-route-badge")).toBeNull();
  });

  it("renders a local route badge when routing is local", () => {
    render(
      <MemoryRouter initialEntries={["/commons/general"]}>
        <AbbyResponseCard
          message={message}
          sources={[]}
          objectReferences={[]}
          routing={{
            model: "local",
            provider: "ollama",
            transport: "ollama_chat",
            reason: "local_ollama_required",
            fallback_used: false,
          }}
        />
      </MemoryRouter>,
    );
    const badge = screen.getByTestId("abby-route-badge");
    expect(badge).toHaveAttribute("data-route-kind", "local");
  });

  it("renders a fallback route badge when a cloud turn fell back local", () => {
    render(
      <MemoryRouter initialEntries={["/commons/general"]}>
        <AbbyResponseCard
          message={message}
          sources={[]}
          objectReferences={[]}
          routing={{
            model: "local",
            provider: "ollama",
            transport: "ollama_chat",
            reason: "budget_exhausted",
            fallback_used: true,
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("abby-route-badge")).toHaveAttribute(
      "data-route-kind",
      "fallback",
    );
  });

  it("opens cited document URLs from source cards", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderCard([
      {
        collection: "docs",
        label: "Documentation",
        title: "Clinical reference",
        url: "https://example.test/reference",
      },
    ]);

    await user.click(screen.getByRole("button", { name: /1 source/i }));
    await user.click(
      screen.getByRole("button", { name: /Clinical reference/i }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.test/reference",
      "_blank",
      "noopener,noreferrer",
    );
  });
});
