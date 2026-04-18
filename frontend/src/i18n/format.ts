import i18next from "i18next";
import { getLocaleMetadata, normalizeLocale, type SupportedLocale } from "./locales";

export function getActiveLocale(): SupportedLocale {
  return normalizeLocale(i18next.resolvedLanguage ?? i18next.language);
}

function toIntlDateLocale(locale: string | null | undefined): string {
  const normalized = normalizeLocale(locale);
  return getLocaleMetadata(normalized).dateLocale;
}

function toIntlNumberLocale(locale: string | null | undefined): string {
  const normalized = normalizeLocale(locale);
  return getLocaleMetadata(normalized).numberLocale;
}

export function formatDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  locale: string | null | undefined = getActiveLocale(),
): string {
  return new Intl.DateTimeFormat(toIntlDateLocale(locale), options).format(
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
  return new Intl.NumberFormat(toIntlNumberLocale(locale), options).format(value);
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
  return new Intl.Collator(toIntlNumberLocale(locale), {
    sensitivity: "base",
    numeric: true,
    ...options,
  });
}
