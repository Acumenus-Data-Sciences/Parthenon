import i18next from "i18next";
import { normalizeLocale, type SupportedLocale } from "./locales";

export function getActiveLocale(): SupportedLocale {
  return normalizeLocale(i18next.resolvedLanguage ?? i18next.language);
}

function toIntlLocale(locale: string | null | undefined): SupportedLocale {
  const normalized = normalizeLocale(locale);
  return normalized === "en-XA" ? "en-US" : normalized;
}

export function formatDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  locale: string | null | undefined = getActiveLocale(),
): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(
    new Date(value),
  );
}

export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
  locale: string | null | undefined = getActiveLocale(),
): string {
  return formatDate(value, options, locale);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: string | null | undefined = getActiveLocale(),
): string {
  return new Intl.NumberFormat(toIntlLocale(locale), options).format(value);
}

export function formatPercent(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale: string | null | undefined = getActiveLocale(),
): string {
  return formatNumber(
    value,
    { style: "percent", maximumFractionDigits: 1, ...options },
    locale,
  );
}

export function createLocaleCollator(
  locale: string | null | undefined = getActiveLocale(),
  options?: Intl.CollatorOptions,
): Intl.Collator {
  return new Intl.Collator(toIntlLocale(locale), {
    sensitivity: "base",
    numeric: true,
    ...options,
  });
}
