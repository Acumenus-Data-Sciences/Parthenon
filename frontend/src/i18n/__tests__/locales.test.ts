import { afterEach, describe, expect, it } from "vitest";
import {
  getLocaleMetadata,
  getLocaleDirection,
  normalizeLocale,
  PUBLIC_SELECTABLE_LOCALES,
  SUPPORTED_LOCALES,
  USER_SELECTABLE_LOCALES,
} from "../locales";
import i18n, { setActiveLocale } from "../i18n";
import { formatNumber } from "../format";
import { resources } from "../resources";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n locale support", () => {
  afterEach(async () => {
    await setActiveLocale("en-US");
  });

  it("normalizes exact, case-insensitive, and language-only locale values", () => {
    expect(normalizeLocale("fr-FR")).toBe("fr-FR");
    expect(normalizeLocale("pt_br")).toBe("pt-BR");
    expect(normalizeLocale("ko")).toBe("ko-KR");
    expect(normalizeLocale("tlh")).toBe("en-US");
  });

  it("tracks RTL direction for Arabic", () => {
    expect(getLocaleDirection("ar")).toBe("rtl");
    expect(getLocaleDirection("hi-IN")).toBe("ltr");
  });

  it("publishes canonical locale metadata for the initial rollout", () => {
    expect(getLocaleMetadata("es").releaseTier).toBe("tier-a-pilot");
    expect(getLocaleMetadata("ko").releaseTier).toBe("tier-a-candidate");
    expect(getLocaleMetadata("ar").releaseTier).toBe("rtl-canary");
    expect(getLocaleMetadata("en-XA")).toMatchObject({
      laravelLocale: "en",
      docusaurusLocale: "en",
      selectable: false,
    });
  });

  it("keeps every supported locale enabled with Intl and fallback metadata", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(locale.enabled).toBe(true);
      expect(locale.laravelLocale).toBeTruthy();
      expect(locale.docusaurusLocale).toBeTruthy();
      expect(locale.dateLocale).toBeTruthy();
      expect(locale.numberLocale).toBeTruthy();
      expect(locale.fallbackLocales.length).toBeGreaterThan(0);
    }
  });

  it("marks the pseudolocale as QA-only metadata", () => {
    expect(getLocaleMetadata("en-XA")).toMatchObject({
      qaOnly: true,
      selectable: false,
      releaseTier: "qa",
    });
  });

  it("publishes completed app languages in the public picker", () => {
    expect(PUBLIC_SELECTABLE_LOCALES.map((locale) => locale.code)).toEqual([
      "en-US",
      "es-ES",
      "fr-FR",
      "de-DE",
      "pt-BR",
      "fi-FI",
      "ja-JP",
      "zh-Hans",
      "ko-KR",
    ]);
    expect(getLocaleMetadata("ar")).toMatchObject({
      qaOnly: true,
      selectable: false,
    });
    expect(getLocaleMetadata("hi-IN").selectable).toBe(false);
  });

  it("keeps QA canary locales available in development and test selectors", () => {
    expect(USER_SELECTABLE_LOCALES.map((locale) => locale.code)).toEqual(
      expect.arrayContaining(["ar", "en-XA"]),
    );
  });

  it("has resources for every selectable locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(i18n.hasResourceBundle(locale.code, "layout")).toBe(true);
    }
  });

  it("keeps shell translation key parity across locales", () => {
    const resourceRecord = resources as Record<string, unknown>;
    const englishKeys = flattenKeys(resourceRecord["en-US"]).sort();

    for (const locale of SUPPORTED_LOCALES) {
      expect(flattenKeys(resourceRecord[locale.code]).sort()).toEqual(englishKeys);
    }
  });

  it("switches language and resolves translated shell keys", async () => {
    await setActiveLocale("es-ES");

    expect(i18n.t("layout:nav.dashboard")).toBe("Panel");
    expect(document.documentElement.lang).toBe("es-ES");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("uses the active locale in formatter helpers", async () => {
    await setActiveLocale("de-DE");

    expect(formatNumber(1234.5)).toBe("1.234,5");
  });
});
