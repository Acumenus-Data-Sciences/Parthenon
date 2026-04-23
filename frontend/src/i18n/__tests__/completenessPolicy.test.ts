import { describe, expect, it } from "vitest";
import { isProtectedSameValue } from "../completenessPolicy";

describe("i18n completeness policy", () => {
  it("protects canonical standards and product identifiers", () => {
    expect(
      isProtectedSameValue({
        locale: "de-DE",
        fullKey: "app.vocabulary.mappingAssistant.vocabularies.SNOMED",
        sourceValue: "SNOMED CT",
      }),
    ).toBe(true);
  });

  it("protects placeholder-style technical content", () => {
    expect(
      isProtectedSameValue({
        locale: "pt-BR",
        fullKey: "app.genomics.uploadDialog.allowedExtensions",
        sourceValue: ".vcf, .maf, .json",
      }),
    ).toBe(true);
  });

  it("protects same-spelling native UI terms when explicitly allowlisted", () => {
    expect(
      isProtectedSameValue({
        locale: "fr-FR",
        fullKey: "common.ui.codeFallback",
        sourceValue: "Code",
      }),
    ).toBe(true);
  });

  it("does not protect plain untranslated interface copy", () => {
    expect(
      isProtectedSameValue({
        locale: "fr-FR",
        fullKey: "app.cohortDefinitions.auto.selectASource_86ba80",
        sourceValue: "Select a source…",
      }),
    ).toBe(false);
  });
});
