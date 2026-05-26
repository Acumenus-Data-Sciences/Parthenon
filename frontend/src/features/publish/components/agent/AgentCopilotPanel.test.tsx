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
    approveTool: vi.fn().mockResolvedValue(undefined),
  };
});

async function getMocks() {
  const mod = await import("../../api/publishAgentApi");
  return mod as typeof mod & {
    startAgentSession: ReturnType<typeof vi.fn>;
    sendAgentMessage: ReturnType<typeof vi.fn>;
    approveTool: ReturnType<typeof vi.fn>;
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
  mocks.approveTool.mockClear();
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

  describe("approval cards", () => {
    it("renders an approval card when the store has a pendingApproval", () => {
      renderPanel();
      act(() => {
        usePublishAgentStore.getState().setSession(1, "private-publish.draft.5");
        usePublishAgentStore.getState().applyEvent({
          type: "approval-request",
          toolUseId: "tu-1",
          tool: "write_file",
          input: { path: "output.md" },
        });
      });
      expect(screen.getByTestId("approval-card")).toBeInTheDocument();
      expect(screen.getByText("write_file")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
    });

    it("clicking Approve calls approveTool with (toolUseId, true)", async () => {
      const mocks = await getMocks();
      renderPanel();
      act(() => {
        usePublishAgentStore.getState().setSession(1, "private-publish.draft.5");
        usePublishAgentStore.getState().applyEvent({
          type: "approval-request",
          toolUseId: "tu-1",
          tool: "write_file",
          input: { path: "output.md" },
        });
      });
      await act(async () => {
        screen.getByRole("button", { name: /approve/i }).click();
        await Promise.resolve();
      });
      expect(mocks.approveTool).toHaveBeenCalledWith(5, 1, "tu-1", true);
    });

    it("clicking Reject calls approveTool with (toolUseId, false)", async () => {
      const mocks = await getMocks();
      renderPanel();
      act(() => {
        usePublishAgentStore.getState().setSession(1, "private-publish.draft.5");
        usePublishAgentStore.getState().applyEvent({
          type: "approval-request",
          toolUseId: "tu-1",
          tool: "write_file",
          input: { path: "output.md" },
        });
      });
      await act(async () => {
        screen.getByRole("button", { name: /reject/i }).click();
        await Promise.resolve();
      });
      expect(mocks.approveTool).toHaveBeenCalledWith(5, 1, "tu-1", false);
    });
  });
});
