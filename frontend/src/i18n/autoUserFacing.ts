import i18next from "i18next";

type TranslationOptions = Record<string, unknown>;

const NAMESPACE_PREFIX = "app:autoUserFacing.";

/**
 * Resolve a user-facing string from the auto-generated `autoUserFacing`
 * resource tree. If the key is not found, fall back to a humanized
 * display string derived from the key's tail segment so the UI never
 * surfaces a raw dotted key path.
 *
 * Single-segment hash keys (e.g. `openQuestions_f30a3eb5`) are humanized
 * by stripping the trailing hash and Title-Casing the leading word.
 * Multi-segment paths (e.g. `studies.v2.pico.startTitle`) take the
 * final dot-segment and Title-Case that. Any interpolation options are
 * applied to both the found and fallback strings.
 */
export function tAuto(key: string, options?: TranslationOptions): string {
  const fullKey = `${NAMESPACE_PREFIX}${key}`;
  const result = i18next.t(fullKey, options);

  // i18next returns the key back when it cannot resolve. We compare
  // against both the fully-qualified key and the raw key in case the
  // namespace separator is stripped by the i18next instance config.
  if (result === fullKey || result === key) {
    return interpolateInto(humanizeKeyTail(key), options);
  }
  return result;
}

function humanizeKeyTail(key: string): string {
  const segments = key.split(".");
  const tail = segments[segments.length - 1] ?? key;
  // Drop trailing hash suffix `_8charhex` produced by autogen tooling so
  // we don't render "Open Questions F30A3eb5".
  const cleaned = tail.replace(/_[0-9a-f]{6,12}$/i, "");
  return titleCase(cleaned);
}

function titleCase(token: string): string {
  return token
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^(.)|\s(.)/g, (match) => match.toUpperCase())
    .trim();
}

/**
 * Apply i18next-style interpolation to a fallback string when the
 * translation lookup missed. Only handles plain `{{name}}` placeholders —
 * the autoUserFacing tree doesn't use plurals or contexts.
 */
function interpolateInto(fallback: string, options?: TranslationOptions): string {
  if (!options) return fallback;
  return fallback.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = options[name];
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : match;
  });
}
