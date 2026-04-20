import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWebApiRegistries,
  useCreateWebApiRegistry,
  useDeleteWebApiRegistry,
  useSyncWebApiRegistry,
} from "../hooks/useSources";
import type { WebApiImportResult } from "@/types/models";

export function WebApiRegistryPage() {
  const { t } = useTranslation("app");
  const { data: registries, isLoading } = useWebApiRegistries();
  const createMutation = useCreateWebApiRegistry();
  const deleteMutation = useDeleteWebApiRegistry();
  const syncMutation = useSyncWebApiRegistry();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authType, setAuthType] = useState<"none" | "basic" | "bearer">("none");
  const [authCredentials, setAuthCredentials] = useState("");
  const [syncResult, setSyncResult] = useState<{ id: number; result: WebApiImportResult } | null>(null);

  const handleCreate = () => {
    if (!name.trim() || !baseUrl.trim()) return;
    createMutation.mutate(
      {
        name: name.trim(),
        base_url: baseUrl.trim(),
        auth_type: authType,
        auth_credentials: authCredentials || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setName("");
          setBaseUrl("");
          setAuthType("none");
          setAuthCredentials("");
        },
      },
    );
  };

  const handleSync = (id: number) => {
    setSyncResult(null);
    syncMutation.mutate(id, {
      onSuccess: (data) => setSyncResult({ id, result: data }),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {t("dataSources.registry.title")}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {t("dataSources.registry.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-surface-base hover:bg-accent transition-colors"
        >
          <Plus size={14} />
          {t("dataSources.actions.addRegistry")}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-accent/30 bg-surface-raised p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                {t("dataSources.common.name")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("dataSources.registry.namePlaceholder")}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                {t("dataSources.common.baseUrl")}
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://webapi.example.com/WebAPI"
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                {t("dataSources.common.authType")}
              </label>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as "none" | "basic" | "bearer")}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
              >
                <option value="none">{t("dataSources.auth.none")}</option>
                <option value="basic">{t("dataSources.auth.basic")}</option>
                <option value="bearer">{t("dataSources.auth.bearer")}</option>
              </select>
            </div>
            {authType !== "none" && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  {authType === "basic"
                    ? t("dataSources.webApiImport.credentials")
                    : t("dataSources.webApiImport.token")}
                </label>
                <input
                  type="password"
                  value={authCredentials}
                  onChange={(e) => setAuthCredentials(e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim() || !baseUrl.trim() || createMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-surface-base hover:bg-accent disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {t("dataSources.actions.create")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-secondary"
            >
              {t("dataSources.actions.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Registry list */}
      {registries && registries.length > 0 ? (
        <div className="space-y-3">
          {registries.map((reg) => (
            <div
              key={reg.id}
              className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-info" />
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">{reg.name}</h3>
                    <p className="text-xs font-mono text-text-muted">{reg.base_url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      reg.is_active
                        ? "bg-success/10 text-success"
                        : "bg-text-muted/10 text-text-muted",
                    )}
                  >
                    {reg.is_active
                      ? t("dataSources.registry.active")
                      : t("dataSources.registry.inactive")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span>
                  {t("dataSources.common.auth")}: {reg.auth_type}
                </span>
                {reg.last_synced_at && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {t("dataSources.common.lastSynced")}:{" "}
                    {new Date(reg.last_synced_at).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSync(reg.id)}
                  disabled={syncMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  {syncMutation.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  {t("dataSources.actions.syncSources")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        t("dataSources.registry.deleteConfirm", {
                          name: reg.name,
                        }),
                      )
                    ) {
                      deleteMutation.mutate(reg.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-critical/20 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  {t("dataSources.actions.delete")}
                </button>
              </div>

              {/* Sync results */}
              {syncResult?.id === reg.id && (
                <div className="rounded-lg border border-border-default bg-surface-base p-3 space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle size={12} />
                      {t("dataSources.webApiImport.importedCount", {
                        count: syncResult.result.imported,
                      })}
                    </span>
                    {syncResult.result.skipped > 0 && (
                      <span className="flex items-center gap-1 text-accent">
                        <XCircle size={12} />
                        {t("dataSources.webApiImport.skippedCount", {
                          count: syncResult.result.skipped,
                        })}
                      </span>
                    )}
                  </div>
                  {syncResult.result.sources.length > 0 && (
                    <div className="text-[11px] text-text-muted space-y-0.5">
                      {syncResult.result.sources.map((s, i) => (
                        <div key={i}>
                          <span className="font-mono">{s.source_key}</span> - {s.status}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
          <Globe size={24} className="text-text-ghost mb-3" />
          <p className="text-sm text-text-muted">
            {t("dataSources.registry.emptyTitle")}
          </p>
          <p className="mt-1 text-xs text-text-ghost">
            {t("dataSources.registry.emptyMessage")}
          </p>
        </div>
      )}
    </div>
  );
}
