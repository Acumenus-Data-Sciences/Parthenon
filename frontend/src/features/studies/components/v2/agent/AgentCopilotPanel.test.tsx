import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentCopilotPanel } from "./AgentCopilotPanel";
import { useStudyDesignerAgentStore } from "../../../stores/studyDesignerAgentStore";

vi.mock("@/lib/echo", () => ({ getEcho: () => null }));
vi.mock("../../../api/agentApi", async (orig) => {
  const actual = await orig<typeof import("../../../api/agentApi")>();
  return {
    ...actual,
    startAgentSession: vi.fn().mockResolvedValue({ agent_session_id: 1, channel_name: "private-study-design.session.7" }),
    sendAgentMessage: vi.fn().mockResolvedValue(undefined),
  };
});

function renderPanel() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AgentCopilotPanel slug="t2dm" sessionId={7} versionId={3} />
    </QueryClientProvider>,
  );
}

afterEach(() => useStudyDesignerAgentStore.getState().reset());

describe("AgentCopilotPanel", () => {
  it("renders the panel and an empty transcript", () => {
    renderPanel();
    expect(screen.getByTestId("agent-copilot-panel")).toBeInTheDocument();
    expect(screen.getByTestId("agent-transcript")).toBeInTheDocument();
  });

  it("renders streamed assistant text from the store", () => {
    renderPanel();
    act(() => {
      useStudyDesignerAgentStore.getState().pushUserMessage("find diabetes concepts");
      useStudyDesignerAgentStore.getState().applyEvent({ type: "text", text: "Searching the vocabulary." });
    });
    expect(screen.getByText("Searching the vocabulary.")).toBeInTheDocument();
  });
});
