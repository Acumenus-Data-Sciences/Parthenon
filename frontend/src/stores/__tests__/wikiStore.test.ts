import { beforeEach, describe, expect, it } from "vitest";
import { useWikiStore } from "../wikiStore";

beforeEach(() => {
  useWikiStore.setState({
    selectedPageSlug: null,
    searchQuery: "",
    lintResponse: null,
    ingestModalOpen: false,
    activityDrawerOpen: false,
    chatDrawerOpen: false,
    pdfModalFilename: null,
    chatMessagesByScope: {},
  });
});

describe("wikiStore", () => {
  it("stores chat threads separately by paper scope", () => {
    useWikiStore.getState().addChatMessage("paper-a", {
      id: "1",
      role: "user",
      content: "Summarize paper A",
      timestamp: "2026-04-07T00:00:00Z",
    });
    useWikiStore.getState().addChatMessage("paper-b", {
      id: "2",
      role: "user",
      content: "Summarize paper B",
      timestamp: "2026-04-07T00:00:01Z",
    });

    expect(useWikiStore.getState().chatMessagesByScope["paper-a"]).toHaveLength(1);
    expect(useWikiStore.getState().chatMessagesByScope["paper-b"]).toHaveLength(1);
    expect(useWikiStore.getState().chatMessagesByScope["paper-a"]?.[0]?.content).toContain("paper A");
  });

  it("can clear one scoped chat without touching others", () => {
    useWikiStore.getState().addChatMessage("paper-a", {
      id: "1",
      role: "user",
      content: "Paper A",
      timestamp: "2026-04-07T00:00:00Z",
    });
    useWikiStore.getState().addChatMessage("paper-b", {
      id: "2",
      role: "user",
      content: "Paper B",
      timestamp: "2026-04-07T00:00:01Z",
    });

    useWikiStore.getState().clearChat("paper-a");

    expect(useWikiStore.getState().chatMessagesByScope["paper-a"]).toEqual([]);
    expect(useWikiStore.getState().chatMessagesByScope["paper-b"]).toHaveLength(1);
  });
});
