import { afterEach, describe, expect, it } from "vitest";
import { useStudyDesignerAgentStore } from "./studyDesignerAgentStore";

afterEach(() => {
  useStudyDesignerAgentStore.getState().reset();
});

describe("studyDesignerAgentStore", () => {
  it("starts empty and not streaming", () => {
    const s = useStudyDesignerAgentStore.getState();
    expect(s.transcript).toEqual([]);
    expect(s.isStreaming).toBe(false);
  });

  it("appends user + assistant turns and accumulates text deltas", () => {
    const st = useStudyDesignerAgentStore.getState();
    st.pushUserMessage("find diabetes concepts");
    st.applyEvent({ type: "text", text: "Searching " });
    st.applyEvent({ type: "text", text: "the vocabulary." });

    const s = useStudyDesignerAgentStore.getState();
    expect(s.transcript[0]).toEqual({ role: "user", text: "find diabetes concepts" });
    expect(s.transcript[1]).toEqual({ role: "assistant", text: "Searching the vocabulary.", tools: [] });
  });

  it("records tool calls on the active assistant turn", () => {
    const st = useStudyDesignerAgentStore.getState();
    st.pushUserMessage("hi");
    st.applyEvent({ type: "tool", name: "search_concepts", input: { query: "t2dm" } });
    const s = useStudyDesignerAgentStore.getState();
    expect(s.transcript[1].tools).toEqual([{ name: "search_concepts", input: { query: "t2dm" } }]);
  });

  it("marks streaming done and stores cost", () => {
    const st = useStudyDesignerAgentStore.getState();
    st.pushUserMessage("hi");
    st.setStreaming(true);
    st.applyEvent({ type: "done", costUsd: 0.2 });
    const s = useStudyDesignerAgentStore.getState();
    expect(s.isStreaming).toBe(false);
    expect(s.lastCostUsd).toBe(0.2);
  });
});
