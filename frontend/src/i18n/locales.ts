export const DEFAULT_LOCALE = "en-US";
export const LOCALE_STORAGE_KEY = "parthenon-locale";

export const SUPPORTED_LOCALES = [
  {
    code: "en-US",
    label: "English (United States)",
    nativeLabel: "English (United States)",
    direction: "ltr",
    laravelLocale: "en",
    docusaurusLocale: "en",
    dateLocale: "en-US",
    numberLocale: "en-US",
    fallbackLocales: ["en"],
    releaseTier: "source",
    enabled: true,
    selectable: true,
  },
  {
    code: "es-ES",
    label: "Spanish (Spain)",
    nativeLabel: "Español (España)",
    direction: "ltr",
    laravelLocale: "es",
    docusaurusLocale: "es",
    dateLocale: "es-ES",
    numberLocale: "es-ES",
    fallbackLocales: ["es", "en-US", "en"],
    releaseTier: "tier-a-pilot",
    enabled: true,
    selectable: true,
  },
  {
    code: "fr-FR",
    label: "French (France)",
    nativeLabel: "Français (France)",
    direction: "ltr",
    laravelLocale: "fr",
    docusaurusLocale: "fr",
    dateLocale: "fr-FR",
    numberLocale: "fr-FR",
    fallbackLocales: ["fr", "en-US", "en"],
    releaseTier: "wave-1-candidate",
    enabled: true,
    selectable: false,
  },
  {
    code: "de-DE",
    label: "German (Germany)",
    nativeLabel: "Deutsch (Deutschland)",
    direction: "ltr",
    laravelLocale: "de",
    docusaurusLocale: "de",
    dateLocale: "de-DE",
    numberLocale: "de-DE",
    fallbackLocales: ["de", "en-US", "en"],
    releaseTier: "wave-1-candidate",
    enabled: true,
    selectable: false,
  },
  {
    code: "pt-BR",
    label: "Portuguese (Brazil)",
    nativeLabel: "Português (Brasil)",
    direction: "ltr",
    laravelLocale: "pt_BR",
    docusaurusLocale: "pt-BR",
    dateLocale: "pt-BR",
    numberLocale: "pt-BR",
    fallbackLocales: ["pt-BR", "pt", "en-US", "en"],
    releaseTier: "wave-1-candidate",
    enabled: true,
    selectable: false,
  },
  {
    code: "fi-FI",
    label: "Finnish (Finland)",
    nativeLabel: "Suomi (Suomi)",
    direction: "ltr",
    laravelLocale: "fi",
    docusaurusLocale: "fi",
    dateLocale: "fi-FI",
    numberLocale: "fi-FI",
    fallbackLocales: ["fi", "en-US", "en"],
    releaseTier: "wave-1-candidate",
    enabled: true,
    selectable: false,
  },
  {
    code: "ja-JP",
    label: "Japanese (Japan)",
    nativeLabel: "日本語 (日本)",
    direction: "ltr",
    laravelLocale: "ja",
    docusaurusLocale: "ja",
    dateLocale: "ja-JP",
    numberLocale: "ja-JP",
    fallbackLocales: ["ja", "en-US", "en"],
    releaseTier: "wave-1-candidate",
    enabled: true,
    selectable: false,
  },
  {
    code: "zh-Hans",
    label: "Chinese (Simplified)",
    nativeLabel: "简体中文",
    direction: "ltr",
    laravelLocale: "zh_Hans",
    docusaurusLocale: "zh-Hans",
    dateLocale: "zh-Hans",
    numberLocale: "zh-Hans",
    fallbackLocales: ["zh-Hans", "zh", "en-US", "en"],
    releaseTier: "wave-1-candidate",
    enabled: true,
    selectable: false,
  },
  {
    code: "ko-KR",
    label: "Korean (South Korea)",
    nativeLabel: "한국어 (대한민국)",
    direction: "ltr",
    laravelLocale: "ko",
    docusaurusLocale: "ko",
    dateLocale: "ko-KR",
    numberLocale: "ko-KR",
    fallbackLocales: ["ko", "en-US", "en"],
    releaseTier: "tier-a-candidate",
    enabled: true,
    selectable: true,
  },
  {
    code: "hi-IN",
    label: "Hindi (India)",
    nativeLabel: "हिन्दी (भारत)",
    direction: "ltr",
    laravelLocale: "hi",
    docusaurusLocale: "hi",
    dateLocale: "hi-IN",
    numberLocale: "hi-IN",
    fallbackLocales: ["hi", "en-US", "en"],
    releaseTier: "wave-1-candidate",
    enabled: true,
    selectable: false,
  },
  {
    code: "ar",
    label: "Arabic",
    nativeLabel: "العربية",
    direction: "rtl",
    laravelLocale: "ar",
    docusaurusLocale: "ar",
    dateLocale: "ar",
    numberLocale: "ar",
    fallbackLocales: ["ar", "en-US", "en"],
    releaseTier: "rtl-canary",
    enabled: true,
    selectable: false,
    qaOnly: true,
  },
  {
    code: "en-XA",
    label: "Pseudolocale",
    nativeLabel: "[!! Pseudolocale !!]",
    direction: "ltr",
    laravelLocale: "en",
    docusaurusLocale: "en",
    dateLocale: "en-US",
    numberLocale: "en-US",
    fallbackLocales: ["en-US", "en"],
    releaseTier: "qa",
    enabled: true,
    selectable: false,
    qaOnly: true,
  },
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]["code"];
export type LocaleDirection = (typeof SUPPORTED_LOCALES)[number]["direction"];
export type LocaleReleaseTier = (typeof SUPPORTED_LOCALES)[number]["releaseTier"];

const showQaLocales =
  import.meta.env.DEV || import.meta.env.VITE_I18N_SHOW_QA_LOCALES === "true";

export const PUBLIC_SELECTABLE_LOCALES = SUPPORTED_LOCALES.filter(
  (locale) => locale.selectable,
);

export const USER_SELECTABLE_LOCALES = SUPPORTED_LOCALES.filter(
  (locale) => locale.selectable || ("qaOnly" in locale && locale.qaOnly && showQaLocales),
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

export function getLocaleMetadata(locale: string | null | undefined) {
  const normalized = normalizeLocale(locale);
  return SUPPORTED_LOCALES.find((item) => item.code === normalized) ?? SUPPORTED_LOCALES[0];
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
