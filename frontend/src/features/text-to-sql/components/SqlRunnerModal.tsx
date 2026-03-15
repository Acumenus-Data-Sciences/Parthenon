import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  X,
  Database,
  AlertTriangle,
} from "lucide-react";
import {
  executeSql,
  getExecutionStatus,
  downloadExecutionCsv,
  type ExecuteResponse,
  type ExecutionStatus,
} from "../api";

interface SqlRunnerModalProps {
  open: boolean;
  onClose: () => void;
  sql: string;
  safety?: string;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = (seconds % 60).toFixed(0);
  return `${minutes}m ${remaining}s`;
}

function stateLabel(state: string): string {
  const labels: Record<string, string> = {
    active: "Executing query\u2026",
    idle: "Idle",
    "idle in transaction": "Processing results\u2026",
    "idle in transaction (aborted)": "Transaction aborted",
    fastpath: "Fast path call",
    disabled: "Tracking disabled",
    completed: "Completed",
    error: "Error",
  };
  return labels[state] ?? state;
}

export function SqlRunnerModal({
  open,
  onClose,
  sql,
  safety = "unknown",
}: SqlRunnerModalProps) {
  const [status, setStatus] = useState<ExecutionStatus | null>(null);
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localElapsed, setLocalElapsed] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const executionIdRef = useRef<string | null>(null);

  const executeMutation = useMutation({
    mutationFn: () => executeSql(sql, safety),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      stopPolling();
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: {
          data?: { error?: string; message?: string };
          status?: number;
        };
        message?: string;
      };
      const msg =
        e.response?.data?.message ??
        e.response?.data?.error ??
        e.message ??
        "Query execution failed";
      setError(msg);
      stopPolling();
    },
  });

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startExecution = useCallback(() => {
    setResult(null);
    setError(null);
    setStatus(null);
    setLocalElapsed(0);
    startTimeRef.current = Date.now();

    // Local elapsed timer
    timerRef.current = setInterval(() => {
      setLocalElapsed(Date.now() - startTimeRef.current);
    }, 100);

    executeMutation.mutate();
  }, [executeMutation]);

  // Start on open
  useEffect(() => {
    if (open && sql) {
      startExecution();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Poll status while executing
  useEffect(() => {
    if (!executeMutation.isPending) return;

    // Small delay to let the backend start
    const timeout = setTimeout(() => {
      pollingRef.current = setInterval(async () => {
        const id = executionIdRef.current;
        if (!id) {
          // Try to get the execution_id from a hypothetical early response
          // For now, poll a dummy — the execute endpoint is synchronous
          // so we poll using the mutation's pending state as our indicator
          return;
        }
        try {
          const s = await getExecutionStatus(id);
          setStatus(s);
        } catch {
          // Ignore polling errors
        }
      }, 1000);
    }, 500);

    return () => {
      clearTimeout(timeout);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [executeMutation.isPending]);

  const isRunning = executeMutation.isPending;
  const isComplete = result !== null;
  const isError = error !== null;

  const handleDownload = () => {
    if (result?.execution_id) {
      downloadExecutionCsv(result.execution_id);
    }
  };

  if (!open) return null;

  const previewRows = result?.rows.slice(0, 100) ?? [];
  const showTruncatedWarning = result?.truncated;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(4px)",
        }}
        onClick={!isRunning ? onClose : undefined}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          width: "min(95vw, 1100px)",
          maxHeight: "90vh",
          background: "#0E0E11",
          border: "1px solid #232328",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "16px 20px",
            borderBottom: "1px solid #232328",
            background: "#111115",
          }}
        >
          <Database size={18} style={{ color: "#2DD4BF" }} />
          <span
            style={{ fontSize: "15px", fontWeight: 600, color: "#F0EDE8" }}
          >
            SQL Query Runner
          </span>
          <button
            onClick={onClose}
            disabled={isRunning}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "1px solid #232328",
              background: "none",
              color: isRunning ? "#333" : "#8A857D",
              cursor: isRunning ? "not-allowed" : "pointer",
              transition: "all 150ms",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Status section */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #232328",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {isRunning && (
            <>
              <Loader2
                size={18}
                style={{
                  color: "#2DD4BF",
                  animation: "spin 1s linear infinite",
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#F0EDE8",
                  }}
                >
                  {status
                    ? stateLabel(status.state)
                    : "Executing query\u2026"}
                </div>
                {status?.wait_event && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#8A857D",
                      marginTop: "2px",
                    }}
                  >
                    Wait: {status.wait_event}
                  </div>
                )}
              </div>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "13px",
                  color: "#C9A227",
                  fontWeight: 600,
                }}
              >
                {formatElapsed(localElapsed)}
              </span>
            </>
          )}

          {isComplete && (
            <>
              <CheckCircle2 size={18} style={{ color: "#2DD4BF" }} />
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#2DD4BF",
                  }}
                >
                  Query completed
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#8A857D",
                    marginTop: "2px",
                  }}
                >
                  {result.row_count.toLocaleString()} rows in{" "}
                  {formatElapsed(result.elapsed_ms)}
                </div>
              </div>
              {showTruncatedWarning && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    border: "1px solid #C9A22740",
                    background: "#C9A22710",
                    color: "#C9A227",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  <AlertTriangle size={11} />
                  Capped at 10,000 rows
                </span>
              )}
            </>
          )}

          {isError && !isComplete && (
            <>
              <XCircle size={18} style={{ color: "#F87171" }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#F87171",
                  }}
                >
                  Query failed
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#F87171",
                    marginTop: "4px",
                    lineHeight: "1.5",
                    opacity: 0.85,
                  }}
                >
                  {error}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Data preview */}
        {isComplete && result.columns.length > 0 && (
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "0",
              minHeight: 0,
            }}
          >
            {/* Row count badge */}
            <div
              style={{
                padding: "8px 20px",
                fontSize: "11px",
                color: "#8A857D",
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                background: "#111115",
                borderBottom: "1px solid #232328",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              {previewRows.length < result.row_count
                ? `Showing ${previewRows.length} of ${result.row_count.toLocaleString()} rows`
                : `${result.row_count.toLocaleString()} rows`}
            </div>

            <div style={{ overflow: "auto", maxHeight: "400px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                }}
              >
                <thead>
                  <tr>
                    {result.columns.map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          color: "#C9A227",
                          fontWeight: 600,
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          borderBottom: "2px solid #232328",
                          background: "#0E0E11",
                          position: "sticky",
                          top: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? "#0E0E11" : "#111115",
                      }}
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          style={{
                            padding: "6px 12px",
                            color: "#C5C0B8",
                            borderBottom: "1px solid #1C1C20",
                            whiteSpace: "nowrap",
                            maxWidth: "300px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {cell === null ? (
                            <span style={{ color: "#555", fontStyle: "italic" }}>
                              null
                            </span>
                          ) : (
                            String(cell)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "14px 20px",
            borderTop: "1px solid #232328",
            background: "#111115",
          }}
        >
          {isComplete && (
            <button
              onClick={handleDownload}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderRadius: "7px",
                border: "1px solid #2DD4BF40",
                background: "#2DD4BF12",
                color: "#2DD4BF",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 150ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#2DD4BF22";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#2DD4BF12";
              }}
            >
              <Download size={14} />
              Download CSV
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isRunning}
            style={{
              padding: "8px 18px",
              borderRadius: "7px",
              border: "1px solid #232328",
              background: "#1C1C20",
              color: isRunning ? "#555" : "#C5C0B8",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isRunning ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "all 150ms",
            }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
