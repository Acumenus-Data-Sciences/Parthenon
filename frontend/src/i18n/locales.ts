export const DEFAULT_LOCALE = "en-US";
export const LOCALE_STORAGE_KEY = "parthenon-locale";

export const SUPPORTED_LOCALES = [
  {
    code: "en-US",
    label: "English (United States)",
    nativeLabel: "English (United States)",
    direction: "ltr",
  },
  {
    code: "es-ES",
    label: "Spanish (Spain)",
    nativeLabel: "Español (España)",
    direction: "ltr",
  },
  {
    code: "fr-FR",
    label: "French (France)",
    nativeLabel: "Français (France)",
    direction: "ltr",
  },
  {
    code: "de-DE",
    label: "German (Germany)",
    nativeLabel: "Deutsch (Deutschland)",
    direction: "ltr",
  },
  {
    code: "pt-BR",
    label: "Portuguese (Brazil)",
    nativeLabel: "Português (Brasil)",
    direction: "ltr",
  },
  {
    code: "fi-FI",
    label: "Finnish (Finland)",
    nativeLabel: "Suomi (Suomi)",
    direction: "ltr",
  },
  {
    code: "ja-JP",
    label: "Japanese (Japan)",
    nativeLabel: "日本語 (日本)",
    direction: "ltr",
  },
  {
    code: "zh-Hans",
    label: "Chinese (Simplified)",
    nativeLabel: "简体中文",
    direction: "ltr",
  },
  {
    code: "ko-KR",
    label: "Korean (South Korea)",
    nativeLabel: "한국어 (대한민국)",
    direction: "ltr",
  },
  {
    code: "hi-IN",
    label: "Hindi (India)",
    nativeLabel: "हिन्दी (भारत)",
    direction: "ltr",
  },
  {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
    direction: "rtl",
  },
  {
    code: "en-XA",
    label: "Pseudolocale",
    nativeLabel: "[!! Pseudolocale !!]",
    direction: "ltr",
    qaOnly: true,
  },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["code"];
export type LocaleDirection = (typeof SUPPORTED_LOCALES)[number]["direction"];

const showQaLocales =
  import.meta.env.DEV || import.meta.env.VITE_I18N_SHOW_QA_LOCALES === "true";

export const USER_SELECTABLE_LOCALES = SUPPORTED_LOCALES.filter(
  (locale) => !("qaOnly" in locale) || showQaLocales,
);

const supportedLocaleCodes = new Set<string>(
  SUPPORTED_LOCALES.map((locale) => locale.code),
);

const supportedLocaleByLowercase = new Map(
  SUPPORTED_LOCALES.map((locale) => [locale.code.toLowerCase(), locale.code]),
);

const languageFallbacks: Record<string, SupportedLocale> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  fi: "fi-FI",
  ja: "ja-JP",
  zh: "zh-Hans",
  ko: "ko-KR",
  hi: "hi-IN",
  ar: "ar",
};

export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  const normalized = locale?.trim().replaceAll("_", "-");
  if (!normalized) return DEFAULT_LOCALE;

  if (supportedLocaleCodes.has(normalized)) {
    return normalized as SupportedLocale;
  }

  const exact = supportedLocaleByLowercase.get(normalized.toLowerCase());
  if (exact) {
    return exact as SupportedLocale;
  }

  const language = normalized.split("-")[0]?.toLowerCase();
  if (language && languageFallbacks[language]) {
    return languageFallbacks[language];
  }

  return DEFAULT_LOCALE;
}

export function getLocaleDirection(locale: string | null | undefined): LocaleDirection {
  return SUPPORTED_LOCALES.find((item) => item.code === normalizeLocale(locale))
    ?.direction ?? "ltr";
}

export function applyDocumentLocale(locale: string | null | undefined): void {
  if (typeof document === "undefined") return;

  const normalized = normalizeLocale(locale);
  document.documentElement.lang = normalized;
  document.documentElement.dir = getLocaleDirection(normalized);
}

export function getStoredLocalePreference(): SupportedLocale | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored ? normalizeLocale(stored) : null;
  } catch {
    return null;
  }
}

export function storeLocalePreference(locale: string | null | undefined): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocale(locale));
  } catch {
    // Locale still applies in-memory via i18next and document attributes.
  }
}

export function getQueryLocale(): SupportedLocale | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const value = params.get("lng") ?? params.get("locale");
  return value ? normalizeLocale(value) : null;
}

export function getBrowserLocale(): SupportedLocale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  for (const language of navigator.languages ?? []) {
    const normalized = normalizeLocale(language);
    if (normalized !== DEFAULT_LOCALE || language.toLowerCase().startsWith("en")) {
      return normalized;
    }
  }

  return normalizeLocale(navigator.language);
}
