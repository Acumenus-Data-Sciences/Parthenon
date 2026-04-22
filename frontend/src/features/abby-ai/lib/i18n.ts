import type { TFunction } from "i18next";

export function getAbbyExamplePrompts(t: TFunction<"app">): string[] {
  return [
    t("abbyLegacy.panel.examples.diabetesMetformin"),
    t("abbyLegacy.panel.examples.aceInhibitors"),
    t("abbyLegacy.panel.examples.hipFracture"),
    t("abbyLegacy.panel.examples.breastCancerChemo"),
  ];
}

export function getAbbyVerbosityLabel(
  t: TFunction<"app">,
  verbosity: "terse" | "normal" | "verbose" | string,
): string {
  if (verbosity === "terse" || verbosity === "normal" || verbosity === "verbose") {
    return t(`abbyLegacy.profile.verbosity.${verbosity}`);
  }

  return verbosity;
}
