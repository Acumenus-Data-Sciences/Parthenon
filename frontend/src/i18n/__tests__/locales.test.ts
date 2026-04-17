import { afterEach, describe, expect, it } from "vitest";
import {
  getLocaleDirection,
  normalizeLocale,
  SUPPORTED_LOCALES,
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
