import { afterEach, describe, expect, it } from "vitest";
import { useAbbyAgentStore } from "./abbyAgentStore";

afterEach(() => {
  useAbbyAgentStore.getState().reset();
});

describe("abbyAgentStore provider/actions plumbing", () => {
  it("defaults to the EE provider with actions enabled", () => {
    const s = useAbbyAgentStore.getState();
    expect(s.provider).toBe("anthropic");
    expect(s.actionsEnabled).toBe(true);
  });

  it("setSession defaults preserve EE behavior when fields are omitted", () => {
    useAbbyAgentStore.getState().setSession(7, "private-abby.study.7");
    const s = useAbbyAgentStore.getState();
    expect(s.agentSessionId).toBe(7);
    expect(s.actionsEnabled).toBe(true);
    expect(s.provider).toBe("anthropic");
  });

  it("setSession records a reads-only CE deployment", () => {
    useAbbyAgentStore.getState().setSession(9, "private-abby.study.9", false, "local");
    const s = useAbbyAgentStore.getState();
    expect(s.actionsEnabled).toBe(false);
    expect(s.provider).toBe("local");
  });

  it("reset restores the EE defaults", () => {
    useAbbyAgentStore.getState().setSession(9, "ch", false, "local");
    useAbbyAgentStore.getState().reset();
    const s = useAbbyAgentStore.getState();
    expect(s.provider).toBe("anthropic");
    expect(s.actionsEnabled).toBe(true);
    expect(s.agentSessionId).toBeNull();
  });
});
