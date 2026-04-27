import { describe, expect, it } from "vitest";
import { getProtocolImportPhase } from "../protocolImportProgress";

describe("ProtocolImportProgress", () => {
  it("maps the protocol import lifecycle to user-facing phases", () => {
    expect(getProtocolImportPhase({ isPending: false, elapsedSeconds: 0 })).toBe("idle");
    expect(getProtocolImportPhase({ isPending: true, elapsedSeconds: 1 })).toBe("uploading");
    expect(getProtocolImportPhase({ isPending: true, elapsedSeconds: 2 })).toBe("analyzing");
    expect(
      getProtocolImportPhase({
        isPending: false,
        elapsedSeconds: 12,
        completedAt: Date.now(),
      }),
    ).toBe("output");
    expect(
      getProtocolImportPhase({
        isPending: false,
        elapsedSeconds: 12,
        failedAt: Date.now(),
      }),
    ).toBe("error");
  });
});
