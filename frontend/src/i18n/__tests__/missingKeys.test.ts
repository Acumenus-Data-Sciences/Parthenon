import { afterEach, describe, expect, it } from "vitest";
import {
  clearMissingTranslationKeys,
  getMissingTranslationKeys,
  recordMissingTranslationKey,
} from "../missingKeys";

describe("missing translation key telemetry", () => {
  afterEach(() => {
    clearMissingTranslationKeys();
  });

  it("records missing keys with language, namespace, and timestamps", () => {
    const first = new Date("2026-04-17T12:00:00.000Z");
    const second = new Date("2026-04-17T12:01:00.000Z");

    recordMissingTranslationKey("ko-KR", "settings", "profile.title", first);
    recordMissingTranslationKey("ko-KR", "settings", "profile.title", second);

    expect(getMissingTranslationKeys()).toEqual([
      {
        languages: ["ko-KR"],
        namespace: "settings",
        key: "profile.title",
        count: 2,
        firstSeenAt: first.toISOString(),
        lastSeenAt: second.toISOString(),
      },
    ]);
  });

  it("keeps namespaces and languages separate for reporting", () => {
    const now = new Date("2026-04-17T12:00:00.000Z");

    recordMissingTranslationKey(["es-ES", "en-US"], "auth", "login.submit", now);
    recordMissingTranslationKey("es-ES", "settings", "profile.title", now);

    expect(getMissingTranslationKeys().map((entry) => entry.namespace)).toEqual([
      "auth",
      "settings",
    ]);
  });
});
