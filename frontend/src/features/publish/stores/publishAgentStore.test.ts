import { afterEach, describe, expect, it } from "vitest";
import { usePublishAgentStore } from "./publishAgentStore";

afterEach(() => {
  usePublishAgentStore.getState().reset();
});

describe("publishAgentStore", () => {
  it("starts empty and not streaming", () => {
    const s = usePublishAgentStore.getState();
    expect(s.transcript).toEqual([]);
    expect(s.isStreaming).toBe(false);
  });

  it("appends user + assistant turns and accumulates text deltas", () => {
    const st = usePublishAgentStore.getState();
    st.pushUserMessage("find diabetes concepts");
    st.applyEvent({ type: "text", text: "Searching " });
    st.applyEvent({ type: "text", text: "the vocabulary." });

    const s = usePublishAgentStore.getState();
    expect(s.transcript[0]).toEqual({ role: "user", text: "find diabetes concepts" });
    expect(s.transcript[1]).toEqual({ role: "assistant", text: "Searching the vocabulary.", tools: [] });
  });

  it("records tool calls on the active assistant turn", () => {
    const st = usePublishAgentStore.getState();
    st.pushUserMessage("hi");
    st.applyEvent({ type: "tool", name: "search_concepts", input: { query: "t2dm" } });
    const s = usePublishAgentStore.getState();
    expect(s.transcript[1].tools).toEqual([{ name: "search_concepts", input: { query: "t2dm" } }]);
  });

  it("marks streaming done and stores cost", () => {
    const st = usePublishAgentStore.getState();
    st.pushUserMessage("hi");
    st.setStreaming(true);
    st.applyEvent({ type: "done", costUsd: 0.2 });
    const s = usePublishAgentStore.getState();
    expect(s.isStreaming).toBe(false);
    expect(s.lastCostUsd).toBe(0.2);
  });

  it("sets error message on error event", () => {
    const st = usePublishAgentStore.getState();
    st.pushUserMessage("hi");
    st.applyEvent({ type: "error", message: "Something went wrong" });
    const s = usePublishAgentStore.getState();
    expect(s.isStreaming).toBe(false);
    expect(s.errorMessage).toBe("Something went wrong");
  });

  it("reset clears all state", () => {
    const st = usePublishAgentStore.getState();
    st.setSession(42, "private-publish.draft.42");
    st.pushUserMessage("test");
    st.reset();
    const s = usePublishAgentStore.getState();
    expect(s.agentSessionId).toBeNull();
    expect(s.channelName).toBeNull();
    expect(s.transcript).toEqual([]);
    expect(s.isStreaming).toBe(false);
    expect(s.lastCostUsd).toBeNull();
    expect(s.errorMessage).toBeNull();
    expect(s.pendingApprovals).toEqual([]);
  });

  describe("pendingApprovals", () => {
    it("approval-request appends a pending item", () => {
      usePublishAgentStore
        .getState()
        .applyEvent({ type: "approval-request", toolUseId: "tu-1", tool: "write_file", input: { path: "out.md" } });
      expect(usePublishAgentStore.getState().pendingApprovals).toEqual([
        { toolUseId: "tu-1", tool: "write_file", input: { path: "out.md" } },
      ]);
    });

    it("a second identical toolUseId does not duplicate", () => {
      const st = usePublishAgentStore.getState();
      st.applyEvent({ type: "approval-request", toolUseId: "tu-1", tool: "write_file", input: { path: "out.md" } });
      st.applyEvent({ type: "approval-request", toolUseId: "tu-1", tool: "write_file", input: { path: "out.md" } });
      expect(usePublishAgentStore.getState().pendingApprovals).toHaveLength(1);
    });

    it("approval-denied removes the matching toolUseId", () => {
      const st = usePublishAgentStore.getState();
      st.applyEvent({ type: "approval-request", toolUseId: "tu-1", tool: "write_file", input: {} });
      st.applyEvent({ type: "approval-request", toolUseId: "tu-2", tool: "read_file", input: {} });
      st.applyEvent({ type: "approval-denied", toolUseId: "tu-1" });
      const approvals = usePublishAgentStore.getState().pendingApprovals;
      expect(approvals).toHaveLength(1);
      expect(approvals[0].toolUseId).toBe("tu-2");
    });

    it("done clears all pending approvals", () => {
      const st = usePublishAgentStore.getState();
      st.applyEvent({ type: "approval-request", toolUseId: "tu-1", tool: "write_file", input: {} });
      st.applyEvent({ type: "done", costUsd: 0.1 });
      expect(usePublishAgentStore.getState().pendingApprovals).toEqual([]);
    });

    it("reset clears pending approvals", () => {
      usePublishAgentStore
        .getState()
        .applyEvent({ type: "approval-request", toolUseId: "tu-1", tool: "write_file", input: {} });
      usePublishAgentStore.getState().reset();
      expect(usePublishAgentStore.getState().pendingApprovals).toEqual([]);
    });
  });
});
