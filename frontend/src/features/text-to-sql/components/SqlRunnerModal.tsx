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
  Play,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  executeSql,
  getExecutionStatus,
  downloadExecutionCsv,
  renderQueryLibraryEntry,
  type ExecuteResponse,
  type ExecutionStatus,
  type QueryLibraryEntry,
  type QueryLibraryParameter,
} from "../api";
import { getErrorMessage } from "@/lib/error-utils";
import { diagnoseSqlError, getExecutionStateLabel } from "../lib/i18n";

interface SqlRunnerModalProps {
  open: boolean;
  onClose: () => void;
  sql: string;
  safety?: string;
  libraryEntry?: QueryLibraryEntry | null;
  initialParams?: Record<string, string>;
  dialect?: string;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = (seconds % 60).toFixed(0);
  return `${minutes}m ${remaining}s`;
}

function ErrorGuidance({ error }: { error: string | null }) {
  const { t } = useTranslation("app");
  if (!error) return null;
  const hint = diagnoseSqlError(t, error);
  if (!hint) return null;

  return (
    <div
      style={{
        marginTop: "10px",
        padding: "12px 14px",
        borderRadius: "8px",
        border: "1px solid color-mix(in srgb, var(--accent) 19%, transparent)",
        background: "color-mix(in srgb, var(--accent) 3%, transparent)",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--accent)",
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <AlertTriangle size={13} />
        {hint.title}
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {hint.suggestions.map((s, i) => (
          <li
            key={i}
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: "1.5",
            }}
          >
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Lazy import to avoid circular deps
import { ConceptSearchInput } from "@/components/concept/ConceptSearchInput";

export function SqlRunnerModal({
  open,
  onClose,
  sql,
  safety = "unknown",
  libraryEntry,
  initialParams,
  dialect = "postgresql",
}: SqlRunnerModalProps) {
  const { t } = useTranslation("app");
  const hasParams = (libraryEntry?.parameters ?? []).length > 0;

  // Phase: "params" (show form first) or "executing" (running/done)
  const [phase, setPhase] = useState<"params" | "executing">(
    hasParams ? "params" : "executing",
  );
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [activeSql, setActiveSql] = useState(sql);

  const [status, setStatus] = useState<ExecutionStatus | null>(null);
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localElapsed, setLocalElapsed] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const executionIdRef = useRef<string | null>(null);

  const executeMutation = useMutation({
    mutationFn: () => executeSql(activeSql, safety),
    onSuccess: (data) => {
      setResult(data);
      setError(null);
      stopPolling();
    },
    onError: (err: unknown) => {
      setError(
        getErrorMessage(
          err,
          t("queryAssistant.sqlRunner.defaults.queryExecutionFailed"),
        ),
      );
      stopPolling();
    },
  });

  const renderMutation = useMutation({
    mutationFn: () =>
      renderQueryLibraryEntry(libraryEntry!.id, {
        dialect,
        params: paramValues,
      }),
    onSuccess: (data) => {
      setActiveSql(data.sql);
      setPhase("executing");
    },
    onError: (err: unknown) => {
      const e = err as {
        response?: { data?: { error?: string; message?: string } };
        message?: string;
      };
      setError(
        e.response?.data?.message ??
          e.response?.data?.error ??
          e.message ??
          t("queryAssistant.sqlRunner.defaults.failedToRenderTemplate"),
      );
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

    timerRef.current = setInterval(() => {
      setLocalElapsed(Date.now() - startTimeRef.current);
    }, 100);

    executeMutation.mutate();
  }, [executeMutation]);

  const handleRunWithParams = useCallback(() => {
    if (libraryEntry) {
      renderMutation.mutate();
    }
  }, [libraryEntry, renderMutation]);

  const handleParamChange = useCallback(
    (param: QueryLibraryParameter, value: string) => {
      setParamValues((prev) => ({ ...prev, [param.key]: value }));
    },
    [],
  );

  // Initialize param values when modal opens — use parent's values if provided
  useEffect(() => {
    if (open) {
      if (hasParams && libraryEntry?.parameters) {
        const defaults = Object.fromEntries(
          libraryEntry.parameters.map((p) => [p.key, p.default ?? ""]),
        );
        setParamValues({ ...defaults, ...initialParams });
        setPhase("params");
      } else {
        setPhase("executing");
      }
      setActiveSql(sql);
      setResult(null);
      setError(null);
      setStatus(null);
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-execute when phase transitions to "executing"
  useEffect(() => {
    if (open && phase === "executing" && !executeMutation.isPending && !result && !error) {
      startExecution();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, open]);

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
          background: "var(--surface-base)",
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
            background: "var(--surface-base)",
          }}
        >
          <Database size={18} style={{ color: "var(--success)" }} />
          <span
            style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}
          >
            {t("queryAssistant.sqlRunner.modal.title")}
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
              color: isRunning ? "var(--surface-highlight)" : "var(--text-muted)",
              cursor: isRunning ? "not-allowed" : "pointer",
              transition: "all 150ms",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Parameter form (shown before execution for library queries) */}
        {phase === "params" && hasParams && libraryEntry?.parameters && (
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #232328",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: "4px",
                }}
              >
                {libraryEntry.name}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  lineHeight: "1.5",
                }}
              >
                {libraryEntry.summary}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "12px",
              }}
            >
              {libraryEntry.parameters.map((param) => (
                <label
                  key={param.key}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {param.label}
                  </span>
                  {param.type === "date" ? (
                    <input
                      type="date"
                      value={paramValues[param.key] ?? ""}
                      onChange={(e) =>
                        handleParamChange(param, e.target.value)
                      }
                      style={{
                        width: "100%",
                        background: "var(--surface-base)",
                        border: "1px solid #232328",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <ConceptSearchInput
                      value={paramValues[param.key] ?? ""}
                      onChange={(val) => handleParamChange(param, val)}
                      paramType={param.type}
                      placeholder={
                        param.default
                          ? t(
                              "queryAssistant.sqlRunner.defaults.typeToSearchConceptsWithDefault",
                              {
                                defaultValue: param.default,
                              },
                            )
                          : t("queryAssistant.sqlRunner.defaults.typeToSearchConcepts")
                      }
                    />
                  )}
                  {param.description && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        lineHeight: "1.4",
                      }}
                    >
                      {param.description}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                  background: "color-mix(in srgb, var(--primary) 8%, transparent)",
                  color: "var(--critical)",
                  fontSize: "12px",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleRunWithParams}
                disabled={renderMutation.isPending}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 22px",
                  borderRadius: "8px",
                  border: "none",
                  background: renderMutation.isPending ? "#4A1020" : "var(--primary)",
                  color: renderMutation.isPending ? "#C5C0B855" : "var(--text-primary)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: renderMutation.isPending ? "not-allowed" : "pointer",
                  transition: "background 150ms",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  if (!renderMutation.isPending) {
                    e.currentTarget.style.background = "#B52238";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!renderMutation.isPending) {
                    e.currentTarget.style.background = "var(--primary)";
                  }
                }}
              >
                {renderMutation.isPending ? (
                  <Loader2
                    size={16}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                ) : (
                  <Play size={15} />
                )}
                {renderMutation.isPending
                  ? t("queryAssistant.sqlRunner.modal.preparing")
                  : t("queryAssistant.sqlRunner.modal.runQuery")}
              </button>
            </div>
          </div>
        )}

        {/* Status section */}
        {phase === "executing" && (
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
                  color: "var(--success)",
                  animation: "spin 1s linear infinite",
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {status
                    ? getExecutionStateLabel(t, status.state)
                    : t("queryAssistant.sqlRunner.state.active")}
                </div>
                {status?.wait_event && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    {t("queryAssistant.sqlRunner.modal.wait", {
                      value: status.wait_event,
                    })}
                  </div>
                )}
              </div>
              <span
                style={{
                  marginLeft: "auto",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "13px",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                {formatElapsed(localElapsed)}
              </span>
            </>
          )}

          {isComplete && (
            <>
              <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--success)",
                  }}
                >
                  {t("queryAssistant.sqlRunner.modal.queryCompleted")}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    marginTop: "2px",
                  }}
                >
                  {t("queryAssistant.sqlRunner.modal.rowsIn", {
                    count: result.row_count.toLocaleString(),
                    elapsed: formatElapsed(result.elapsed_ms),
                  })}
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
                    border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                    background: "color-mix(in srgb, var(--accent) 6%, transparent)",
                    color: "var(--accent)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  <AlertTriangle size={11} />
                  {t("queryAssistant.sqlRunner.modal.cappedAt10k")}
                </span>
              )}
            </>
          )}

          {isError && !isComplete && (
            <>
              <XCircle size={18} style={{ color: "var(--critical)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--critical)",
                  }}
                >
                  {t("queryAssistant.sqlRunner.modal.queryFailed")}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--critical)",
                    marginTop: "4px",
                    lineHeight: "1.5",
                    opacity: 0.85,
                  }}
                >
                  {error}
                </div>
                <ErrorGuidance error={error} />
              </div>
            </>
          )}
        </div>
        )}

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
                color: "var(--text-muted)",
                fontWeight: 600,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                background: "var(--surface-base)",
                borderBottom: "1px solid #232328",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              {previewRows.length < result.row_count
                ? t("queryAssistant.sqlRunner.modal.showingSomeRows", {
                    shown: previewRows.length,
                    total: result.row_count.toLocaleString(),
                  })
                : t("queryAssistant.sqlRunner.modal.showingAllRows", {
                    count: result.row_count.toLocaleString(),
                  })}
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
                          color: "var(--accent)",
                          fontWeight: 600,
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                          borderBottom: "2px solid #232328",
                          background: "var(--surface-base)",
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
                        background: i % 2 === 0 ? "var(--surface-base)" : "var(--surface-base)",
                      }}
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          style={{
                            padding: "6px 12px",
                            color: "var(--text-secondary)",
                            borderBottom: "1px solid #1C1C20",
                            whiteSpace: "nowrap",
                            maxWidth: "300px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {cell === null ? (
                            <span style={{ color: "var(--text-ghost)", fontStyle: "italic" }}>
                              {t("queryAssistant.sqlRunner.modal.nullValue")}
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
            background: "var(--surface-base)",
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
                border: "1px solid color-mix(in srgb, var(--success) 25%, transparent)",
                background: "color-mix(in srgb, var(--success) 7%, transparent)",
                color: "var(--success)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 150ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "color-mix(in srgb, var(--success) 13%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "color-mix(in srgb, var(--success) 7%, transparent)";
              }}
            >
              <Download size={14} />
              {t("queryAssistant.sqlRunner.modal.downloadCsv")}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isRunning}
            style={{
              padding: "8px 18px",
              borderRadius: "7px",
              border: "1px solid #232328",
              background: "var(--surface-overlay)",
              color: isRunning ? "var(--text-ghost)" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isRunning ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "all 150ms",
            }}
          >
            {t("queryAssistant.sqlRunner.modal.close")}
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
