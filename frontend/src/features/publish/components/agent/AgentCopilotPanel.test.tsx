import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentCopilotPanel } from "./AgentCopilotPanel";
import { usePublishAgentStore } from "../../stores/publishAgentStore";

vi.mock("@/lib/echo", () => ({ getEcho: () => null }));
vi.mock("../../api/publishAgentApi", async (orig) => {
  const actual = await orig<typeof import("../../api/publishAgentApi")>();
  return {
    ...actual,
    startAgentSession: vi.fn().mockResolvedValue({ agent_session_id: 1, channel_name: "private-publish.draft.5" }),
    sendAgentMessage: vi.fn().mockResolvedValue(undefined),
  };
});

async function getMocks() {
  const mod = await import("../../api/publishAgentApi");
  return mod as typeof mod & {
    startAgentSession: ReturnType<typeof vi.fn>;
    sendAgentMessage: ReturnType<typeof vi.fn>;
  };
}

function renderPanel() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AgentCopilotPanel draftId={5} />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  const mocks = await getMocks();
  mocks.startAgentSession.mockClear();
  mocks.sendAgentMessage.mockClear();
});

afterEach(() => usePublishAgentStore.getState().reset());

describe("AgentCopilotPanel", () => {
  it("renders the panel and an empty transcript", () => {
    renderPanel();
    expect(screen.getByTestId("agent-copilot-panel")).toBeInTheDocument();
    expect(screen.getByTestId("agent-transcript")).toBeInTheDocument();
  });

  it("renders streamed assistant text from the store", () => {
    renderPanel();
    act(() => {
      usePublishAgentStore.getState().pushUserMessage("improve introduction");
      usePublishAgentStore.getState().applyEvent({ type: "text", text: "Revising the introduction." });
    });
    expect(screen.getByText("Revising the introduction.")).toBeInTheDocument();
  });

  it("auto-start fires exactly once even under React-19 strict double-invoke", async () => {
    const mocks = await getMocks();
    renderPanel();
    // Allow microtasks / mutation effects to settle
    await act(async () => {
      await Promise.resolve();
    });
    expect(mocks.startAgentSession).toHaveBeenCalledTimes(1);
  });

  it("input is disabled while streaming", () => {
    renderPanel();
    act(() => {
      usePublishAgentStore.getState().setSession(1, "private-publish.draft.5");
      usePublishAgentStore.getState().pushUserMessage("test");
    });
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });
});
