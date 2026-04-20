import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import {
  applyDocumentLocale,
  DEFAULT_LOCALE,
  getBrowserLocale,
  getQueryLocale,
  getStoredLocalePreference,
  normalizeLocale,
  storeLocalePreference,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "./locales";
import { recordMissingTranslationKey } from "./missingKeys";
import { namespaces, resources } from "./resources";

const supportedLocaleCodes = SUPPORTED_LOCALES.map((locale) => locale.code);

export function resolveInitialLocale(
  userLocale?: string | null,
): SupportedLocale {
  if (userLocale) return normalizeLocale(userLocale);

  return (
    getQueryLocale() ??
    getStoredLocalePreference() ??
    getBrowserLocale() ??
    DEFAULT_LOCALE
  );
}

export async function setActiveLocale(
  locale: string | null | undefined,
): Promise<SupportedLocale> {
  const normalized = normalizeLocale(locale);

  if (i18next.language !== normalized) {
    await i18next.changeLanguage(normalized);
  }

  applyDocumentLocale(normalized);
  storeLocalePreference(normalized);

  return normalized;
}

void i18next.use(initReactI18next).init({
  resources,
  lng: resolveInitialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocaleCodes,
  load: "currentOnly",
  ns: namespaces,
  defaultNS: "common",
  fallbackNS: "common",
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
  react: {
    useSuspense: false,
  },
  initAsync: false,
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (lng, ns, key) => {
    const missingKey = recordMissingTranslationKey(lng, ns, key);

    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing key`, missingKey);
    }
  },
});

applyDocumentLocale(i18next.language);

export default i18next;
