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
