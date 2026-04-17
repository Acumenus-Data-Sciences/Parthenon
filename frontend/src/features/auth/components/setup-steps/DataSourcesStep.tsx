import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
} from "lucide-react";
import { useSources, useImportFromWebApi } from "@/features/data-sources/hooks/useSources";
import { cn } from "@/lib/utils";
import type { WebApiImportResult } from "@/types/models";

interface Props {
  onConfigured: () => void;
}

type Source = {
  id: number;
  source_name: string;
  source_key: string;
  source_dialect: string;
  daimons?: unknown[];
};

function EunomiaCallout() {
  const { t } = useTranslation("auth");

  return (
    <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-info/20">
        <FlaskConical size={13} className="text-info" />
      </div>
      <div className="text-base">
        <p className="font-semibold text-text-secondary">
          {t("setup.dataSources.demoTitle")}
        </p>
        <p className="mt-0.5 text-sm text-text-muted leading-relaxed">
          {t("setup.dataSources.demoPrefix")}{" "}
          <strong className="text-text-secondary">
            {t("setup.dataSources.demoPatients")}
          </strong>{" "}
          {t("setup.dataSources.demoSuffix")}
        </p>
      </div>
    </div>
  );
}

export function DataSourcesStep({ onConfigured }: Props) {
  const { t } = useTranslation("auth");
  const { data: sourcesData, isLoading } = useSources();
  const importMutation = useImportFromWebApi();

  const sources: Source[] = Array.isArray(sourcesData)
    ? (sourcesData as Source[])
    : ((sourcesData as unknown as { data?: Source[] })?.data ?? []);

  const [webApiUrl, setWebApiUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "basic" | "bearer">("none");
  const [authCredentials, setAuthCredentials] = useState("");
  const [importResult, setImportResult] = useState<WebApiImportResult | null>(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (sources.length > 0) onConfigured();
  }, [sources.length, onConfigured]);

  function handleImport() {
    if (!webApiUrl.trim()) return;
    const payload: { webapi_url: string; auth_type?: string; auth_credentials?: string } = {
      webapi_url: webApiUrl,
    };
    if (authType !== "none") {
      payload.auth_type = authType;
      payload.auth_credentials = authCredentials;
    }
    importMutation.mutate(payload, {
      onSuccess: (result) => {
        setImportResult(result);
        onConfigured();
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
        <span className="ml-2 text-sm text-text-muted">
          {t("setup.dataSources.loading")}
        </span>
      </div>
    );
  }

  const eunomiaSource = sources.find((s) => s.source_key?.toUpperCase() === "EUNOMIA");
  const otherSources = sources.filter((s) => s.source_key?.toUpperCase() !== "EUNOMIA");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">
          {t("setup.dataSources.title")}
        </h3>
        <p className="text-base text-text-muted">
          {t("setup.dataSources.intro")}
        </p>
      </div>

      {/* Eunomia callout — shown when demo dataset is present */}
      {eunomiaSource && <EunomiaCallout />}

      {/* Existing non-Eunomia sources */}
      {otherSources.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
            {t("setup.dataSources.configuredSources", {
              count: otherSources.length,
            })}
          </p>
          {otherSources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-overlay px-4 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-elevated">
                <Database size={14} className="text-info" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-text-primary">
                  {source.source_name}
                </p>
                <p className="text-sm text-text-muted">
                  {source.source_key}{" "}
                  <span aria-hidden="true">·</span>{" "}
                  {source.source_dialect}
                  {source.daimons && (
                    <span className="ml-1">
                      <span aria-hidden="true">·</span>{" "}
                      {source.daimons.length}{" "}
                      {t(
                        source.daimons.length === 1
                          ? "setup.dataSources.daimon"
                          : "setup.dataSources.daimons",
                      )}
                    </span>
                  )}
                </p>
              </div>
              <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state — no sources at all */}
      {sources.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-overlay py-10">
          <Database size={24} className="text-text-ghost" />
          <h4 className="mt-3 text-sm font-semibold text-text-primary">
            {t("setup.dataSources.emptyTitle")}
          </h4>
          <p className="mt-1 text-xs text-text-muted">
            {t("setup.dataSources.emptyDescription")}
          </p>
        </div>
      )}

      {/* Import from WebAPI */}
      <div>
        <button
          type="button"
          onClick={() => setShowImport((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            showImport
              ? "border-accent/40 text-accent"
              : "border-border-default text-text-muted hover:text-text-secondary",
          )}
        >
          <Upload size={14} />
          {t("setup.dataSources.importToggle")}
        </button>

        {showImport && (
          <div className="mt-3 space-y-3 rounded-lg border border-border-default bg-surface-overlay p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-text-muted">
                  {t("setup.dataSources.webApiUrl")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 font-mono text-base text-text-primary placeholder:text-text-ghost focus:outline-none focus:ring-2 focus:ring-accent/50"
                  value={webApiUrl}
                  onChange={(e) => setWebApiUrl(e.target.value)}
                  placeholder="https://atlas.example.com/WebAPI"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-text-muted">
                  {t("setup.dataSources.authType")}
                </label>
                <select
                  className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as "none" | "basic" | "bearer")}
                >
                  <option value="none">{t("setup.dataSources.auth.none")}</option>
                  <option value="basic">{t("setup.dataSources.auth.basic")}</option>
                  <option value="bearer">{t("setup.dataSources.auth.bearer")}</option>
                </select>
              </div>
            </div>

            {authType !== "none" && (
              <div>
                <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-text-muted">
                  {authType === "basic"
                    ? t("setup.dataSources.auth.basicCredentials")
                    : t("setup.dataSources.auth.bearerCredentials")}
                </label>
                <input
                  type="password"
                  className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-base text-text-primary placeholder:text-text-ghost focus:outline-none focus:ring-2 focus:ring-accent/50"
                  value={authCredentials}
                  onChange={(e) => setAuthCredentials(e.target.value)}
                  placeholder={
                    authType === "basic"
                      ? t("setup.dataSources.auth.basicPlaceholder")
                      : t("setup.dataSources.auth.bearerPlaceholder")
                  }
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={!webApiUrl.trim() || importMutation.isPending}
              className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent-light disabled:opacity-50"
            >
              {importMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              {t("setup.dataSources.importSources")}
            </button>

            {importResult && (
              <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                {t("setup.dataSources.importSuccess", {
                  count: importResult.imported,
                  label: t(
                    importResult.imported === 1
                      ? "setup.dataSources.sourceSingular"
                      : "setup.dataSources.sourcePlural",
                  ),
                })}
                {importResult.skipped > 0 && (
                  <span className="text-emerald-300/80">
                    {t("setup.dataSources.importSkipped", {
                      count: importResult.skipped,
                    })}
                  </span>
                )}
              </div>
            )}

            {importMutation.isError && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                {t("setup.dataSources.importFailed")}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-text-ghost">
        {t("setup.dataSources.managePrefix")}{" "}
        <span className="text-text-muted">
          {t("setup.dataSources.manageLink")}
        </span>
      </p>
    </div>
  );
}
