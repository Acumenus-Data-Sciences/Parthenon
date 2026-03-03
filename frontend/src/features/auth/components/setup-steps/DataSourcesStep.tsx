import { useState, useEffect } from "react";
import { Database, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useSources, useImportFromWebApi } from "@/features/data-sources/hooks/useSources";
import { cn } from "@/lib/utils";
import type { WebApiImportResult } from "@/types/models";

interface Props {
  onConfigured: () => void;
}

export function DataSourcesStep({ onConfigured }: Props) {
  const { data: sourcesData, isLoading } = useSources();
  const importMutation = useImportFromWebApi();

  // Handle both paginated {data: Source[]} and plain Source[] responses
  const sources = Array.isArray(sourcesData)
    ? sourcesData
    : (sourcesData as { data?: unknown[] })?.data ?? [];

  const [webApiUrl, setWebApiUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "basic" | "bearer">("none");
  const [authCredentials, setAuthCredentials] = useState("");
  const [importResult, setImportResult] = useState<WebApiImportResult | null>(null);
  const [showImport, setShowImport] = useState(false);

  // Mark configured if sources already exist
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
        <Loader2 className="h-6 w-6 animate-spin text-[#C9A227]" />
        <span className="ml-2 text-sm text-[#8A857D]">Loading data sources...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[#F0EDE8]">Data Sources</h3>
        <p className="text-sm text-[#8A857D]">
          Connect CDM databases to run cohort definitions and analyses against. You can also
          import sources from a legacy OHDSI WebAPI instance.
        </p>
      </div>

      {/* Existing sources */}
      {sources.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[#8A857D]">
            Configured sources ({sources.length})
          </p>
          <div className="space-y-2">
            {(sources as { id: number; source_name: string; source_key: string; source_dialect: string; daimons?: unknown[] }[]).map((source) => (
              <div
                key={source.id}
                className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#1A1A1E] px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#232328]">
                  <Database size={14} className="text-[#818CF8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#F0EDE8] truncate">
                    {source.source_name}
                  </p>
                  <p className="text-xs text-[#8A857D]">
                    {source.source_key} &middot; {source.source_dialect}
                    {source.daimons && (
                      <span className="ml-1">
                        &middot; {source.daimons.length} daimon{source.daimons.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
                <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#1A1A1E] py-10">
          <Database size={24} className="text-[#5A5650]" />
          <h4 className="mt-3 text-sm font-semibold text-[#F0EDE8]">No data sources yet</h4>
          <p className="mt-1 text-xs text-[#8A857D]">
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
              ? "border-[#C9A227]/40 text-[#C9A227]"
              : "border-[#232328] text-[#8A857D] hover:text-[#C5C0B8]",
          )}
        >
          <Upload size={14} />
          Import from Legacy WebAPI
        </button>

        {showImport && (
          <div className="mt-3 rounded-lg border border-[#232328] bg-[#1A1A1E] p-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#8A857D]">
                  WebAPI URL
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] font-mono placeholder:text-[#5A5650] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/50"
                  value={webApiUrl}
                  onChange={(e) => setWebApiUrl(e.target.value)}
                  placeholder="https://atlas.example.com/WebAPI"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#8A857D]">
                  Auth Type
                </label>
                <select
                  className="w-full rounded-md border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/50"
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
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#8A857D]">
                  {authType === "basic" ? "Username:Password" : "Token"}
                </label>
                <input
                  type="password"
                  className="w-full rounded-md border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:ring-2 focus:ring-[#C9A227]/50"
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
              className="flex items-center gap-1.5 rounded-md bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#D4AE3A] disabled:opacity-50"
            >
              {importMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Import Sources
            </button>

            {/* Import result */}
            {importResult && (
              <div className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                <p className="font-medium">
                  Imported {importResult.imported} source{importResult.imported !== 1 ? "s" : ""}
                  {importResult.skipped > 0 && (
                    <span className="font-normal text-emerald-300/80">
                      , {importResult.skipped} skipped (already exist)
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Import error */}
            {importMutation.isError && (
              <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertCircle size={14} className="shrink-0" />
                Import failed. Please check the URL and try again.
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-[#5A5650]">
        You can also manage data sources from the Data Sources page after setup.
      </p>
    </div>
  );
}
