import { Database, Globe, Layers, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AdminLevel, Country, GisStats } from "../types";

const DISPLAY_LEVELS: AdminLevel[] = ["ADM0", "ADM1", "ADM2", "ADM3"];

interface BoundaryExplorerPanelProps {
  stats: GisStats | undefined;
  countries: Country[] | undefined;
  level: AdminLevel;
  countryCode: string;
  parentGid: string | null;
  featureCount: number;
  canLoad: boolean;
  isLoading: boolean;
  isError: boolean;
  onLevelChange: (level: AdminLevel) => void;
  onCountryChange: (countryCode: string) => void;
  onClearParent: () => void;
}

export function BoundaryExplorerPanel({
  stats,
  countries,
  level,
  countryCode,
  parentGid,
  featureCount,
  canLoad,
  isLoading,
  isError,
  onLevelChange,
  onCountryChange,
  onClearParent,
}: BoundaryExplorerPanelProps) {
  const { t } = useTranslation("app");
  const levelStats = new Map(stats?.levels.map((item) => [item.code, item]) ?? []);

  return (
    <div className="flex w-64 flex-col gap-3 overflow-y-auto border-r border-border-default bg-surface-base p-3">
      <div className="rounded-lg border border-border-default bg-surface-raised p-3">
        <div className="mb-2 flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("gis.boundaryExplorer.title")}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat
            label={t("gis.boundaryExplorer.boundaries")}
            value={stats?.total_boundaries.toLocaleString() ?? "0"}
          />
          <Stat
            label={t("gis.boundaryExplorer.countries")}
            value={stats?.total_countries.toLocaleString() ?? "0"}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-raised p-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-ghost">
          {t("gis.boundaryExplorer.country")}
        </label>
        <select
          value={countryCode}
          onChange={(event) => onCountryChange(event.target.value)}
          className="w-full rounded border border-border-default bg-surface-base px-2 py-1.5 text-xs text-text-primary focus:border-accent/50 focus:outline-none"
        >
          <option value="">{t("gis.boundaryExplorer.allCountries")}</option>
          {(countries ?? []).map((country) => (
            <option key={country.code} value={country.code}>
              {country.name} ({country.code})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border-default bg-surface-raised p-3">
        <div className="mb-2 flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-text-ghost" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("gis.boundaryExplorer.adminLevel")}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {DISPLAY_LEVELS.map((code) => {
            const count = levelStats.get(code)?.count ?? 0;
            const selected = code === level;
            return (
              <button
                key={code}
                type="button"
                onClick={() => onLevelChange(code)}
                disabled={count === 0}
                className={`rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                  selected
                    ? "border-accent/70 bg-accent/15 text-accent"
                    : "border-border-default bg-surface-base text-text-muted hover:border-text-ghost"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="block font-semibold">{code}</span>
                <span className="text-[10px] text-text-ghost">
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {parentGid && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-accent">
              {t("gis.boundaryExplorer.parent")}
            </span>
            <button
              type="button"
              onClick={onClearParent}
              className="rounded p-0.5 text-text-ghost hover:text-text-primary"
              aria-label={t("gis.boundaryExplorer.clearParent")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="truncate text-xs text-text-muted">{parentGid}</p>
        </div>
      )}

      <div className="rounded-lg border border-border-default bg-surface-raised p-3">
        <div className="mb-1 flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-text-ghost" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("gis.boundaryExplorer.loaded")}
          </h3>
        </div>
        <p className="text-lg font-semibold text-text-primary">
          {featureCount.toLocaleString()}
        </p>
        <p className="text-[10px] text-text-ghost">
          {isLoading
            ? t("gis.boundaryExplorer.loading")
            : isError
              ? t("gis.boundaryExplorer.error")
              : canLoad
                ? t("gis.boundaryExplorer.visibleFeatures")
                : t("gis.boundaryExplorer.guardrail")}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-default bg-surface-base p-2">
      <span className="block text-[10px] uppercase text-text-ghost">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}
