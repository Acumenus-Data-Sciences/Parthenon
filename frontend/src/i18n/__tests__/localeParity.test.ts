import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "../locales";

type BackendLocaleConfig = {
  default: string;
  supported: Record<
    string,
    {
      label: string;
      native_label: string;
      direction: string;
      laravel: string;
      docusaurus: string;
      date_locale: string;
      number_locale: string;
      fallbacks: string[];
      release_tier: string;
      enabled: boolean;
      selectable: boolean;
      qa_only?: boolean;
    }
  >;
};

function loadBackendLocaleConfig(): BackendLocaleConfig {
  const configPath = path.resolve(
    process.cwd(),
    "../backend/config/parthenon-locales.php",
  );
  const php = `echo json_encode(require ${JSON.stringify(configPath)});`;
  const output = execFileSync("php", ["-r", php], { encoding: "utf8" });

  return JSON.parse(output) as BackendLocaleConfig;
}

describe("frontend/backend locale metadata parity", () => {
  it("keeps supported locale metadata aligned with Laravel config", () => {
    const backend = loadBackendLocaleConfig();
    const frontendCodes = SUPPORTED_LOCALES.map((locale) => locale.code);
    const backendCodes = Object.keys(backend.supported);

    expect(backend.default).toBe("en-US");
    expect(frontendCodes).toEqual(backendCodes);

    for (const locale of SUPPORTED_LOCALES) {
      const backendLocale = backend.supported[locale.code];

      expect(backendLocale).toBeDefined();
      expect({
        label: locale.label,
        native_label: locale.nativeLabel,
        direction: locale.direction,
        laravel: locale.laravelLocale,
        docusaurus: locale.docusaurusLocale,
        date_locale: locale.dateLocale,
        number_locale: locale.numberLocale,
        fallbacks: [...locale.fallbackLocales],
        release_tier: locale.releaseTier,
        enabled: locale.enabled,
        selectable: locale.selectable,
        qa_only: "qaOnly" in locale ? locale.qaOnly : undefined,
      }).toEqual({
        ...backendLocale,
        qa_only: backendLocale.qa_only,
      });
    }
  });
});
