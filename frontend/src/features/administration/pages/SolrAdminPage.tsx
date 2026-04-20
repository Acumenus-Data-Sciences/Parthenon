import { useState, useEffect, useCallback } from "react";
import apiClient from "@/lib/api-client";
import { RefreshCw, Trash2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, Badge, StatusDot, Button } from "@/components/ui";
import { HelpButton } from "@/features/help";

interface CoreStatus {
  core: string;
  available: boolean;
  document_count: number | null;
  last_indexed_at: string | null;
  last_index_duration_seconds: number | null;
  indexing: boolean;
}

export default function SolrAdminPage() {
  const { t } = useTranslation("app");
  const [statuses, setStatuses] = useState<Record<string, CoreStatus>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Record<string, CoreStatus> }>("/admin/solr/status");
      setStatuses(res.data.data ?? {});
    } catch {
      setMessage({ type: "error", text: t("administration.solrAdmin.messages.fetchFailed") });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const reindex = async (core: string, fresh = false) => {
    setActionLoading(`reindex-${core}`);
    setMessage(null);
    try {
      const res = await apiClient.post<{ message: string; document_count?: number }>(
        `/admin/solr/reindex/${core}`,
        { fresh },
      );
      setMessage({
        type: "success",
        text: res.data.message ?? t("administration.solrAdmin.messages.reindexCompleted", { core }),
      });
      fetchStatus();
    } catch {
      setMessage({
        type: "error",
        text: t("administration.solrAdmin.messages.reindexFailed", { core }),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const reindexAll = async () => {
    setActionLoading("reindex-all");
    setMessage(null);
    try {
      const res = await apiClient.post<{ message: string }>("/admin/solr/reindex-all");
      setMessage({
        type: "success",
        text: res.data.message ?? t("administration.solrAdmin.messages.reindexAllCompleted"),
      });
      fetchStatus();
    } catch {
      setMessage({
        type: "error",
        text: t("administration.solrAdmin.messages.reindexAllFailed"),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const clearCore = async (core: string) => {
    if (!confirm(t("administration.solrAdmin.messages.clearConfirm", { core }))) return;
    setActionLoading(`clear-${core}`);
    setMessage(null);
    try {
      await apiClient.post(`/admin/solr/clear/${core}`);
      setMessage({
        type: "success",
        text: t("administration.solrAdmin.messages.clearCompleted", { core }),
      });
      fetchStatus();
    } catch {
      setMessage({
        type: "error",
        text: t("administration.solrAdmin.messages.clearFailed", { core }),
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("administration.solrAdmin.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("administration.solrAdmin.loadingCoreStatus")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-border bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("administration.solrAdmin.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("administration.solrAdmin.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="admin.solr" />
          <Button
            variant="primary"
            size="sm"
            onClick={reindexAll}
            disabled={actionLoading !== null}
          >
            {actionLoading === "reindex-all" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            {t("administration.solrAdmin.actions.reindexAll")}
          </Button>
        </div>
      </div>

      {message && (
        <Panel className={message.type === "success" ? "border-emerald-500/30" : "border-destructive/30"}>
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm text-foreground">{message.text}</span>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.entries(statuses).map(([name, status]) => (
          <Panel key={name}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <StatusDot status={status.available ? "healthy" : "critical"} />
                <div>
                  <p className="font-semibold capitalize text-foreground">{name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{status.core}</p>
                </div>
              </div>
              <Badge variant={status.available ? "success" : "critical"}>
                {status.available
                  ? t("administration.solrAdmin.status.healthy")
                  : t("administration.solrAdmin.status.unavailable")}
              </Badge>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">
                  {t("administration.solrAdmin.labels.documents")}
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {status.document_count !== null ? status.document_count.toLocaleString() : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t("administration.solrAdmin.labels.lastIndexed")}
                </p>
                <p className="text-foreground">
                  {status.last_indexed_at
                    ? new Date(status.last_indexed_at).toLocaleString()
                    : t("administration.solrAdmin.values.never")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  {t("administration.solrAdmin.labels.duration")}
                </p>
                <p className="text-foreground">
                  {status.last_index_duration_seconds
                    ? t("administration.solrAdmin.values.seconds", {
                        seconds: status.last_index_duration_seconds,
                      })
                    : "—"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => reindex(name)}
                disabled={actionLoading !== null || !status.available}
              >
                {actionLoading === `reindex-${name}` ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                )}
                {t("administration.solrAdmin.actions.reindex")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => reindex(name, true)}
                disabled={actionLoading !== null || !status.available}
              >
                {t("administration.solrAdmin.actions.fullReindex")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => clearCore(name)}
                disabled={actionLoading !== null || !status.available}
              >
                {actionLoading === `clear-${name}` ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                )}
                {t("administration.solrAdmin.actions.clear")}
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
