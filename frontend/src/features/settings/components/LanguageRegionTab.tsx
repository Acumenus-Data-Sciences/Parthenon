import { Globe2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  getLocaleDirection,
  normalizeLocale,
  PUBLIC_SELECTABLE_LOCALES,
} from "@/i18n/locales";
import { formatDate, formatNumber } from "@/i18n/format";
import { useUpdateLocale } from "../hooks/useProfile";

export function LanguageRegionTab() {
  const { t } = useTranslation("settings");
  const user = useAuthStore((state) => state.user);
  const updateLocale = useUpdateLocale();
  const selectedLocale = normalizeLocale(user?.locale);
  const selectedDirection = getLocaleDirection(selectedLocale);

  const handleLocaleChange = (locale: string) => {
    const nextLocale = normalizeLocale(locale);
    if (nextLocale === selectedLocale) return;

    updateLocale.mutate({ locale: nextLocale });
  };

  const selectClass = cn(
    "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm",
    "text-text-primary focus:border-success focus:outline-none focus:ring-1 focus:ring-success/40",
  );

  return (
    <div className="max-w-2xl space-y-8">
      <section className="rounded-lg border border-border-default bg-surface-raised p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
            <Globe2 size={18} className="text-success" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {t("languageRegion.title")}
            </h3>
            <p className="text-xs text-text-muted">
              {t("languageRegion.subtitle")}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t("languageRegion.languageLabel")}
          </label>
          <select
            value={selectedLocale}
            onChange={(event) => handleLocaleChange(event.target.value)}
            disabled={updateLocale.isPending}
            className={selectClass}
          >
            {PUBLIC_SELECTABLE_LOCALES.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.nativeLabel}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-ghost">
            {t("languageRegion.languageHelp")}
          </p>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t("languageRegion.previewTitle")}
          </h4>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-muted">{t("languageRegion.datePreview")}</dt>
              <dd className="font-medium text-text-primary">
                {formatDate(new Date("2026-04-17T12:00:00Z"), { dateStyle: "full" }, selectedLocale)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-muted">{t("languageRegion.numberPreview")}</dt>
              <dd className="font-medium text-text-primary">
                {formatNumber(1234567.89, { maximumFractionDigits: 2 }, selectedLocale)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-text-muted">{t("languageRegion.directionPreview")}</dt>
              <dd className="font-medium text-text-primary">
                {selectedDirection === "rtl"
                  ? t("languageRegion.rtl")
                  : t("languageRegion.ltr")}
              </dd>
            </div>
          </dl>
        </div>

        {updateLocale.isPending && (
          <p className="inline-flex items-center gap-2 text-sm text-text-muted">
            <Loader2 size={14} className="animate-spin" />
            {t("languageRegion.saving")}
          </p>
        )}
        {updateLocale.isSuccess && !updateLocale.isPending && (
          <p className="inline-flex items-center gap-2 text-sm text-success">
            <CheckCircle2 size={14} />
            {t("languageRegion.saved")}
          </p>
        )}
        {updateLocale.isError && (
          <p className="inline-flex items-center gap-2 text-sm text-critical">
            <AlertCircle size={14} />
            {t("languageRegion.saveFailed")}
          </p>
        )}
      </section>
    </div>
  );
}
