import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Database,
  Play,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  validateSql,
  type GenerateResponse,
  type ValidateResponse,
  type QueryLibraryEntry,
  type QueryLibraryParameter,
} from "../api";
import { SqlBlock } from "./SqlBlock";
import { useTranslation } from "react-i18next";
import { getComplexityLabel } from "../lib/i18n";

function getErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as {
    response?: { data?: { detail?: string; message?: string; error?: string } };
    message?: string;
  };
  return (
    e.response?.data?.detail ??
    e.response?.data?.message ??
    e.response?.data?.error ??
    e.message ??
    fallback
  );
}

function ComplexityBadge({ level }: { level: "low" | "medium" | "high" }) {
  const { t } = useTranslation("app");
  const styles: Record<string, string> = {
    low: "bg-success/15 text-success border-success/30",
    medium: "bg-accent/15 text-accent border-accent/30",
    high: "bg-primary/20 text-primary border-primary/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[level]}`}
    >
      <Zap size={10} />
      {getComplexityLabel(t, level)}
    </span>
  );
}

function SafetyBadge({ safety }: { safety: "safe" | "unsafe" | "unknown" }) {
  const { t } = useTranslation("app");
  if (safety === "safe") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "3px 10px",
          borderRadius: "20px",
          border: "1px solid #2DD4BF40",
          background: "#2DD4BF12",
          color: "var(--success)",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        <ShieldCheck size={13} />
        {t("queryAssistant.results.safeReadOnly")}
      </span>
    );
  }
  if (safety === "unknown") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "3px 10px",
          borderRadius: "20px",
          border: "1px solid #C9A22740",
          background: "#C9A22710",
          color: "var(--accent)",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        <ShieldAlert size={13} />
        {t("queryAssistant.results.needsReview")}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "20px",
        border: "1px solid #9B1B3050",
        background: "#9B1B3018",
        color: "var(--critical)",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      <ShieldAlert size={13} />
      {t("queryAssistant.results.unsafe")}
    </span>
  );
}

interface ResultsPanelProps {
  result: GenerateResponse;
  selectedLibrary: QueryLibraryEntry | null;
  libraryParams: Record<string, string>;
  onLibraryParamChange: (param: QueryLibraryParameter, value: string) => void;
  onRerenderLibrary: () => void;
  isRenderPending: boolean;
  renderError: unknown;
  dialect?: string;
}

export function ResultsPanel({
  result,
  selectedLibrary,
  libraryParams,
  onLibraryParamChange,
  onRerenderLibrary,
  isRenderPending,
  renderError,
  dialect,
}: ResultsPanelProps) {
  const { t } = useTranslation("app");
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [renderSuccess, setRenderSuccess] = useState(false);
  const prevRenderPending = useRef(isRenderPending);

  useEffect(() => {
    if (prevRenderPending.current && !isRenderPending && !renderError) {
      const showTimer = window.setTimeout(() => setRenderSuccess(true), 0);
      const hideTimer = window.setTimeout(() => setRenderSuccess(false), 2500);
      prevRenderPending.current = isRenderPending;
      return () => {
        window.clearTimeout(showTimer);
        window.clearTimeout(hideTimer);
      };
    }
    prevRenderPending.current = isRenderPending;
  }, [isRenderPending, renderError]);

  const validateMutation = useMutation({
    mutationFn: ({ sql, schema }: { sql: string; schema?: string }) =>
      validateSql(sql, schema),
    onSuccess: (data) => setValidation(data),
  });

  const handleValidate = () => {
    if (!result.sql) return;
    validateMutation.mutate({ sql: result.sql });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Library match badge */}
      {result.source_type === "library" && result.query && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid #2DD4BF30",
            borderRadius: "8px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "6px",
            }}
          >
            <Database size={15} style={{ color: "var(--success)" }} />
            <span
              style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}
            >
              {t("queryAssistant.results.queryLibraryMatch")}
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginLeft: "auto",
              }}
            >
              {result.query.domain}
            </span>
          </div>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: "4px",
            }}
          >
            {result.template_name}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "var(--text-muted)",
              lineHeight: "1.5",
            }}
          >
            {result.query.summary}
          </p>
        </div>
      )}

      {/* Template parameters */}
      {selectedLibrary?.parameters && selectedLibrary.parameters.length > 0 && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid #232328",
            borderRadius: "8px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {t("queryAssistant.results.templateParameters")}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            {selectedLibrary.parameters.map((parameter) => (
              <label
                key={parameter.key}
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
                  {parameter.label}
                </span>
                <input
                  type={
                    parameter.type === "number"
                      ? "number"
                      : parameter.type === "date"
                        ? "date"
                        : "text"
                  }
                  value={libraryParams[parameter.key] ?? ""}
                  onChange={(e) =>
                    onLibraryParamChange(parameter, e.target.value)
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
                  }}
                />
                {parameter.description && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      lineHeight: "1.4",
                    }}
                  >
                    {parameter.description}
                  </span>
                )}
              </label>
            ))}
          </div>
          <div>
            <button
              onClick={onRerenderLibrary}
              disabled={isRenderPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: `1px solid ${renderSuccess ? "#2DD4BF40" : "var(--surface-elevated)"}`,
                background: renderSuccess ? "#2DD4BF12" : "var(--surface-overlay)",
                color: renderSuccess ? "var(--success)" : "var(--text-secondary)",
                fontSize: "13px",
                cursor: isRenderPending ? "not-allowed" : "pointer",
                transition: "all 300ms",
              }}
            >
              {isRenderPending ? (
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : renderSuccess ? (
                <CheckCircle2 size={14} />
              ) : (
                <Play size={14} />
              )}
              {isRenderPending
                ? t("queryAssistant.results.rendering")
                : renderSuccess
                  ? t("queryAssistant.results.sqlUpdated")
                  : t("queryAssistant.results.renderTemplate")}
            </button>
          </div>
          {typeof renderError === "string" && renderError && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #9B1B3040",
                background: "#9B1B3015",
                color: "var(--critical)",
                fontSize: "12px",
              }}
            >
              {getErrorMessage(
                renderError,
                t("queryAssistant.results.renderFailed"),
              )}
            </div>
          )}
        </div>
      )}

      {/* SQL output */}
      <div>
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "8px",
          }}
        >
          {t("queryAssistant.results.generatedSql")}
        </div>
        <SqlBlock sql={result.sql} safety={result.safety} libraryEntry={selectedLibrary} libraryParams={libraryParams} dialect={dialect} />
      </div>

      {/* Metadata row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <SafetyBadge safety={result.safety} />
        {result.is_aggregate && (
          <span
            style={{
              padding: "3px 10px",
              borderRadius: "20px",
              border: "1px solid #C9A22740",
              background: "#C9A22710",
              color: "var(--accent)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {t("queryAssistant.results.aggregate")}
          </span>
        )}
      </div>

      {/* Tables referenced */}
      {result.tables_referenced.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "7px",
            }}
          >
            {t("queryAssistant.results.tablesReferenced")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {result.tables_referenced.map((t) => (
              <span
                key={t}
                style={{
                  padding: "3px 10px",
                  borderRadius: "5px",
                  border: "1px solid #232328",
                  background: "var(--surface-overlay)",
                  color: "var(--accent)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "11px",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Explanation */}
      {result.explanation && (
        <div
          style={{
            background: "var(--surface-raised)",
            border: "1px solid #232328",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "8px",
            }}
          >
            {t("queryAssistant.results.explanation")}
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              lineHeight: "1.65",
              margin: 0,
            }}
          >
            {result.explanation}
          </p>
        </div>
      )}

      {/* Validate */}
      <div>
        <button
          onClick={handleValidate}
          disabled={validateMutation.isPending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            padding: "8px 18px",
            borderRadius: "7px",
            border: "1px solid #232328",
            background: "var(--surface-overlay)",
            color: "var(--text-secondary)",
            fontSize: "13px",
            fontWeight: 500,
            cursor: validateMutation.isPending ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "all 150ms",
            opacity: validateMutation.isPending ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!validateMutation.isPending) {
              e.currentTarget.style.background = "var(--surface-elevated)";
              e.currentTarget.style.borderColor = "#2DD4BF40";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--surface-overlay)";
            e.currentTarget.style.borderColor = "var(--surface-elevated)";
          }}
        >
          {validateMutation.isPending ? (
            <Loader2
              size={14}
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : (
            <ShieldCheck size={14} style={{ color: "var(--success)" }} />
          )}
          {validateMutation.isPending
            ? t("queryAssistant.results.validating")
            : t("queryAssistant.results.validateSql")}
        </button>

        {validation && (
          <div
            style={{
              marginTop: "12px",
              background: "var(--surface-raised)",
              border: `1px solid ${validation.valid ? "#2DD4BF30" : "#9B1B3030"}`,
              borderRadius: "8px",
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              {validation.valid ? (
                <ShieldCheck size={15} style={{ color: "var(--success)" }} />
              ) : (
                <ShieldAlert size={15} style={{ color: "var(--critical)" }} />
              )}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: validation.valid ? "var(--success)" : "var(--critical)",
                }}
              >
                {validation.valid
                  ? t("queryAssistant.results.validSql")
                  : t("queryAssistant.results.validationFailed")}
              </span>
              {validation.read_only && (
                <span
                  style={{
                    padding: "1px 8px",
                    borderRadius: "20px",
                    border: "1px solid #2DD4BF30",
                    background: "#2DD4BF10",
                    color: "var(--success)",
                    fontSize: "11px",
                    fontWeight: 600,
                    marginLeft: "auto",
                  }}
                >
                  {t("queryAssistant.results.readOnly")}
                </span>
              )}
            </div>
            <ComplexityBadge level={validation.estimated_complexity} />
            {validation.tables.length > 0 && (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}
              >
                {validation.tables.map((t) => (
                  <span
                    key={t}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      border: "1px solid #232328",
                      background: "var(--surface-overlay)",
                      color: "var(--text-secondary)",
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "11px",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                }}
              >
                {validation.warnings.map((w, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "7px 10px",
                      borderRadius: "5px",
                      border: "1px solid #C9A22730",
                      background: "#C9A22710",
                      color: "var(--accent)",
                      fontSize: "12px",
                      lineHeight: "1.5",
                    }}
                  >
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {validateMutation.isError && !validation && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid #9B1B3040",
              background: "#9B1B3015",
              color: "var(--critical)",
              fontSize: "13px",
            }}
          >
              {getErrorMessage(
                validateMutation.error,
                t("queryAssistant.results.validateError"),
              )}
            </div>
          )}
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
