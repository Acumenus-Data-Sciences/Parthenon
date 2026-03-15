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

interface ErrorHint {
  title: string;
  suggestions: string[];
}

function diagnoseError(error: string): ErrorHint | null {
  const lower = error.toLowerCase();

  if (
    lower.includes("must begin with select or with") ||
    lower.includes("not sql") ||
    (!lower.includes("syntax error") && /^[a-z]/.test(error) && !lower.startsWith("select") && !lower.startsWith("with"))
  ) {
    return {
      title: "The AI returned an explanation instead of SQL",
      suggestions: [
        "Try rephrasing your question to be more specific",
        "Use the Query Library tab to find a pre-built template",
        "Specify the exact tables and columns you want to query",
      ],
    };
  }

  if (lower.includes("backtick")) {
    return {
      title: "MySQL-style backticks are not supported",
      suggestions: [
        "PostgreSQL uses double quotes for identifiers: \"column_name\"",
        "Most OMOP column names don\u2019t need quoting at all",
        "Try regenerating the query \u2014 the AI sometimes uses MySQL syntax",
      ],
    };
  }

  if (lower.includes("syntax error")) {
    const match = error.match(/at or near "([^"]+)"/);
    const near = match?.[1];
    return {
      title: near ? `Syntax error near "${near}"` : "SQL syntax error",
      suggestions: [
        "The generated SQL has a syntax issue \u2014 try regenerating with a clearer question",
        "Check for mismatched parentheses, missing commas, or extra keywords",
        "Use the Validate SQL button first to catch issues before running",
      ],
    };
  }

  if (lower.includes("statement timeout") || lower.includes("canceling statement")) {
    return {
      title: "Query timed out (120s limit)",
      suggestions: [
        "Add more specific WHERE conditions to reduce the data scanned",
        "Add a LIMIT clause to cap the result set",
        "Avoid SELECT * \u2014 select only the columns you need",
        "Consider filtering by date range to narrow the dataset",
      ],
    };
  }

  if (lower.includes("relation") && lower.includes("does not exist")) {
    const match = error.match(/relation "([^"]+)" does not exist/);
    const table = match?.[1];
    return {
      title: table ? `Table "${table}" not found` : "Table not found",
      suggestions: [
        "OMOP tables must be schema-qualified: omop.person, omop.condition_occurrence",
        "Use the Schema Browser at the bottom of the page to verify table names",
        "Check spelling \u2014 common tables: person, condition_occurrence, drug_exposure, measurement",
      ],
    };
  }

  if (lower.includes("column") && lower.includes("does not exist")) {
    const match = error.match(/column "([^"]+)" does not exist/);
    const col = match?.[1];
    return {
      title: col ? `Column "${col}" not found` : "Column not found",
      suggestions: [
        "Expand the table in the Schema Browser to see available columns",
        "OMOP column names use underscores: person_id, condition_start_date",
        "Check if you need a JOIN to another table that has this column",
      ],
    };
  }

  if (lower.includes("permission denied") || lower.includes("only administrators")) {
    return {
      title: "Insufficient permissions",
      suggestions: [
        "This query was not classified as \u201csafe\u201d (read-only)",
        "Only administrators can run queries that aren\u2019t marked safe",
        "Use the Validate SQL button to check the safety classification",
      ],
    };
  }

  return null;
}

function ErrorGuidance({ error }: { error: string | null }) {
  if (!error) return null;
  const hint = diagnoseError(error);
  if (!hint) return null;

  return (
    <div
      style={{
        marginTop: "10px",
        padding: "12px 14px",
        borderRadius: "8px",
        border: "1px solid #C9A22730",
        background: "#C9A22708",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "#C9A227",
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
              color: "#C5C0B8",
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
import { ConceptSearchInput } from "./ConceptSearchInput";

export function SqlRunnerModal({
  open,
  onClose,
  sql,
  safety = "unknown",
  libraryEntry,
  initialParams,
  dialect = "postgresql",
}: SqlRunnerModalProps) {
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
          "Failed to render template",
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
                  color: "#F0EDE8",
                  marginBottom: "4px",
                }}
              >
                {libraryEntry.name}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#8A857D",
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
                      color: "#C5C0B8",
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
                        background: "#0E0E11",
                        border: "1px solid #232328",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        color: "#F0EDE8",
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
                          ? `${param.default} \u2014 type to search OMOP concepts`
                          : "Type to search OMOP concepts\u2026"
                      }
                    />
                  )}
                  {param.description && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#8A857D",
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
                  border: "1px solid #9B1B3040",
                  background: "#9B1B3015",
                  color: "#F87171",
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
                  background: renderMutation.isPending ? "#4A1020" : "#9B1B30",
                  color: renderMutation.isPending ? "#C5C0B855" : "#F0EDE8",
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
                    e.currentTarget.style.background = "#9B1B30";
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
                  ? "Preparing\u2026"
                  : "Run Query"}
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
              <XCircle size={18} style={{ color: "#F87171", flexShrink: 0 }} />
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
