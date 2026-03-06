import { useState, useEffect, useCallback } from "react";
import apiClient from "@/lib/api-client";
import { Database, RefreshCw, Trash2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface CoreStatus {
  core: string;
  available: boolean;
  document_count: number | null;
  last_indexed_at: string | null;
  last_index_duration_seconds: number | null;
  indexing: boolean;
}

export default function SolrAdminPage() {
  const [statuses, setStatuses] = useState<Record<string, CoreStatus>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: Record<string, CoreStatus> }>("/admin/solr/status");
      setStatuses(res.data.data ?? {});
    } catch {
      setMessage({ type: "error", text: "Failed to fetch Solr status" });
    } finally {
      setLoading(false);
    }
  }, []);

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
      setMessage({ type: "success", text: res.data.message ?? `Reindex of '${core}' completed` });
      fetchStatus();
    } catch {
      setMessage({ type: "error", text: `Failed to reindex '${core}'` });
    } finally {
      setActionLoading(null);
    }
  };

  const reindexAll = async () => {
    setActionLoading("reindex-all");
    setMessage(null);
    try {
      const res = await apiClient.post<{ message: string }>("/admin/solr/reindex-all");
      setMessage({ type: "success", text: res.data.message ?? "Reindex-all completed" });
      fetchStatus();
    } catch {
      setMessage({ type: "error", text: "Failed to reindex all cores" });
    } finally {
      setActionLoading(null);
    }
  };

  const clearCore = async (core: string) => {
    if (!confirm(`Are you sure you want to clear all documents from '${core}'? This cannot be undone.`)) return;
    setActionLoading(`clear-${core}`);
    setMessage(null);
    try {
      await apiClient.post(`/admin/solr/clear/${core}`);
      setMessage({ type: "success", text: `Core '${core}' cleared` });
      fetchStatus();
    } catch {
      setMessage({ type: "error", text: `Failed to clear '${core}'` });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center" style={{ padding: "var(--space-12)" }}>
          <Loader2 className="animate-spin" size={24} />
          <span style={{ marginLeft: 8 }}>Loading Solr status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Database size={24} />
            Solr Search Administration
          </h1>
          <p className="page-subtitle">
            Manage Solr search cores, trigger reindexing, and monitor status.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={reindexAll}
          disabled={actionLoading !== null}
        >
          {actionLoading === "reindex-all" ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          Re-index All Cores
        </button>
      </div>

      {message && (
        <div
          className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}
          style={{ marginBottom: "var(--space-4)" }}
        >
          {message.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "var(--space-4)" }}>
        {Object.entries(statuses).map(([name, status]) => (
          <div key={name} className="card" style={{ padding: "var(--space-5)" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-3)" }}>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600, textTransform: "capitalize" }}>
                {name}
              </h3>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "var(--text-xs)",
                  padding: "2px 8px",
                  borderRadius: 12,
                  backgroundColor: status.available ? "rgba(45,212,191,0.15)" : "rgba(239,68,68,0.15)",
                  color: status.available ? "var(--teal)" : "var(--danger)",
                }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: status.available ? "var(--teal)" : "var(--danger)",
                }} />
                {status.available ? "Healthy" : "Unavailable"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", fontSize: "var(--text-sm)", marginBottom: "var(--space-4)" }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Documents</span>
                <div style={{ fontWeight: 600, fontSize: "var(--text-lg)" }}>
                  {status.document_count !== null ? status.document_count.toLocaleString() : "—"}
                </div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Core</span>
                <div style={{ fontFamily: "monospace" }}>{status.core}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Last Indexed</span>
                <div>{status.last_indexed_at ? new Date(status.last_indexed_at).toLocaleString() : "Never"}</div>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Duration</span>
                <div>{status.last_index_duration_seconds ? `${status.last_index_duration_seconds}s` : "—"}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => reindex(name)}
                disabled={actionLoading !== null || !status.available}
              >
                {actionLoading === `reindex-${name}` ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <RefreshCw size={14} />
                )}
                Re-index
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => reindex(name, true)}
                disabled={actionLoading !== null || !status.available}
              >
                Full Re-index
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => clearCore(name)}
                disabled={actionLoading !== null || !status.available}
                style={{ color: "var(--danger)" }}
              >
                {actionLoading === `clear-${name}` ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Trash2 size={14} />
                )}
                Clear
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
