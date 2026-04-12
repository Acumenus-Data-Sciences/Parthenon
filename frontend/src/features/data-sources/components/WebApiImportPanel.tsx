import { useState } from "react";
import { Upload, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useImportFromWebApi } from "../hooks/useSources";
import type { WebApiImportResult } from "@/types/models";

export function WebApiImportPanel() {
  const [url, setUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "basic" | "bearer">("none");
  const [credentials, setCredentials] = useState("");
  const [result, setResult] = useState<WebApiImportResult | null>(null);

  const importMutation = useImportFromWebApi();

  const handleImport = () => {
    if (!url.trim()) return;
    setResult(null);
    importMutation.mutate(
      {
        webapi_url: url.trim(),
        auth_type: authType,
        auth_credentials: credentials || undefined,
      },
      { onSuccess: (data) => setResult(data) },
    );
  };

  return (
    <div className="space-y-4 rounded-lg border border-border-default bg-surface-raised p-5">
      <div className="flex items-center gap-2">
        <Upload size={16} className="text-accent" />
        <h3 className="text-sm font-semibold text-text-primary">
          Import from Legacy WebAPI
        </h3>
      </div>
      <p className="text-xs text-text-muted">
        Connect to an existing OHDSI WebAPI instance and import its configured
        data sources into Parthenon.
      </p>

      <div className="grid gap-3">
        {/* URL */}
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            WebAPI Base URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://legacy-webapi.example.com/WebAPI"
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>

        {/* Auth */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Authentication
            </label>
            <select
              value={authType}
              onChange={(e) => setAuthType(e.target.value as "none" | "basic" | "bearer")}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
            >
              <option value="none">None</option>
              <option value="basic">Basic Auth</option>
              <option value="bearer">Bearer Token</option>
            </select>
          </div>
          {authType !== "none" && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                {authType === "basic" ? "Credentials (user:pass)" : "Token"}
              </label>
              <input
                type="password"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder={authType === "basic" ? "username:password" : "Bearer token"}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleImport}
        disabled={!url.trim() || importMutation.isPending}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
          "bg-accent text-surface-base hover:bg-accent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {importMutation.isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Upload size={14} />
        )}
        Import Sources
      </button>

      {/* Error */}
      {importMutation.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2">
          <XCircle size={14} className="text-critical shrink-0" />
          <p className="text-xs text-critical">
            {(importMutation.error as Error)?.message ?? "Import failed"}
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle size={12} />
              {result.imported} imported
            </div>
            {result.skipped > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-accent">
                <AlertTriangle size={12} />
                {result.skipped} skipped
              </div>
            )}
          </div>

          {result.sources.length > 0 && (
            <div className="rounded-lg border border-border-default overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default bg-surface-base">
                    <th className="px-3 py-2 text-left font-medium text-text-muted">Source Key</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">Source Name</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sources.map((s, i) => (
                    <tr key={i} className="border-b border-border-default last:border-0">
                      <td className="px-3 py-2 font-mono text-text-secondary">{s.source_key}</td>
                      <td className="px-3 py-2 text-text-primary">{s.source_name}</td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                            s.status === "imported"
                              ? "bg-success/10 text-success"
                              : "bg-accent/10 text-accent",
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
