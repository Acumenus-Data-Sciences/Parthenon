import { useState, useEffect } from "react";
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
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#818CF8]/30 bg-[#818CF8]/10 px-4 py-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#818CF8]/20">
        <FlaskConical size={13} className="text-[#818CF8]" />
      </div>
      <div className="text-base">
        <p className="font-semibold text-text-secondary">
          Eunomia GiBleed Demo Dataset loaded
        </p>
        <p className="mt-0.5 text-sm text-text-muted leading-relaxed">
          A synthetic OMOP CDM dataset with <strong className="text-text-secondary">2,694 patients</strong> and
          gastrointestinal bleeding episodes. Safe to run cohort definitions and characterization analyses against — ideal
          for exploring Parthenon before connecting your real CDM.
        </p>
      </div>
    </div>
  );
}

export function DataSourcesStep({ onConfigured }: Props) {
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
        <span className="ml-2 text-sm text-text-muted">Loading data sources...</span>
      </div>
    );
  }

  const eunomiaSource = sources.find((s) => s.source_key?.toUpperCase() === "EUNOMIA");
  const otherSources = sources.filter((s) => s.source_key?.toUpperCase() !== "EUNOMIA");

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">Data Sources</h3>
        <p className="text-base text-text-muted">
          Connect CDM databases to run cohort definitions and analyses against. You can also
          import sources from a legacy OHDSI WebAPI instance.
        </p>
      </div>

      {/* Eunomia callout — shown when demo dataset is present */}
      {eunomiaSource && <EunomiaCallout />}

      {/* Existing non-Eunomia sources */}
      {otherSources.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
            Configured sources ({otherSources.length})
          </p>
          {otherSources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-overlay px-4 py-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-elevated">
                <Database size={14} className="text-[#818CF8]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-text-primary">
                  {source.source_name}
                </p>
                <p className="text-sm text-text-muted">
                  {source.source_key} &middot; {source.source_dialect}
                  {source.daimons && (
                    <span className="ml-1">
                      &middot; {source.daimons.length} daimon
                      {source.daimons.length !== 1 ? "s" : ""}
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
          <h4 className="mt-3 text-sm font-semibold text-text-primary">No data sources yet</h4>
          <p className="mt-1 text-xs text-text-muted">
            Import from a legacy WebAPI instance or add sources from the Data Sources page later.
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
          Import from Legacy WebAPI
        </button>

        {showImport && (
          <div className="mt-3 space-y-3 rounded-lg border border-border-default bg-surface-overlay p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-text-muted">
                  WebAPI URL
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
                  Auth Type
                </label>
                <select
                  className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as "none" | "basic" | "bearer")}
                >
                  <option value="none">None</option>
                  <option value="basic">Basic</option>
                  <option value="bearer">Bearer Token</option>
                </select>
              </div>
            </div>

            {authType !== "none" && (
              <div>
                <label className="mb-1 block text-sm font-medium uppercase tracking-wide text-text-muted">
                  {authType === "basic" ? "Username:Password" : "Token"}
                </label>
                <input
                  type="password"
                  className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-base text-text-primary placeholder:text-text-ghost focus:outline-none focus:ring-2 focus:ring-accent/50"
                  value={authCredentials}
                  onChange={(e) => setAuthCredentials(e.target.value)}
                  placeholder={authType === "basic" ? "user:password" : "Bearer token"}
                />
              </div>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={!webApiUrl.trim() || importMutation.isPending}
              className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-[#D4AE3A] disabled:opacity-50"
            >
              {importMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Import Sources
            </button>

            {importResult && (
              <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                Imported {importResult.imported} source
                {importResult.imported !== 1 ? "s" : ""}
                {importResult.skipped > 0 && (
                  <span className="text-emerald-300/80">
                    , {importResult.skipped} skipped (already exist)
                  </span>
                )}
              </div>
            )}

            {importMutation.isError && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                Import failed. Please check the URL and try again.
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-text-ghost">
        Manage data sources any time from{" "}
        <span className="text-text-muted">Settings → Data Sources</span>.
      </p>
    </div>
  );
}
