import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Database,
  Play,
  Zap,
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
  const styles: Record<string, string> = {
    low: "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30",
    medium: "bg-[#C9A227]/15 text-[#C9A227] border-[#C9A227]/30",
    high: "bg-[#9B1B30]/20 text-[#9B1B30] border-[#9B1B30]/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[level]}`}
    >
      <Zap size={10} />
      {level} complexity
    </span>
  );
}

function SafetyBadge({ safety }: { safety: "safe" | "unsafe" | "unknown" }) {
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
          color: "#2DD4BF",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        <ShieldCheck size={13} />
        SAFE — Read Only
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
          color: "#C9A227",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        <ShieldAlert size={13} />
        NEEDS REVIEW
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
        color: "#F87171",
        fontSize: "12px",
        fontWeight: 600,
      }}
    >
      <ShieldAlert size={13} />
      UNSAFE
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
}

export function ResultsPanel({
  result,
  selectedLibrary,
  libraryParams,
  onLibraryParamChange,
  onRerenderLibrary,
  isRenderPending,
  renderError,
}: ResultsPanelProps) {
  const [validation, setValidation] = useState<ValidateResponse | null>(null);

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
            background: "#151518",
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
            <Database size={15} style={{ color: "#2DD4BF" }} />
            <span
              style={{ fontSize: "13px", fontWeight: 600, color: "#F0EDE8" }}
            >
              Query Library Match
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "#8A857D",
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
              color: "#C5C0B8",
              marginBottom: "4px",
            }}
          >
            {result.template_name}
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#8A857D",
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
            background: "#151518",
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
              color: "#8A857D",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Template Parameters
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
                    color: "#C5C0B8",
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
                    background: "#0E0E11",
                    border: "1px solid #232328",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    color: "#F0EDE8",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                {parameter.description && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#8A857D",
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
                border: "1px solid #232328",
                background: "#1C1C20",
                color: "#C5C0B8",
                fontSize: "13px",
                cursor: isRenderPending ? "not-allowed" : "pointer",
              }}
            >
              {isRenderPending ? (
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Play size={14} />
              )}
              {isRenderPending ? "Rendering\u2026" : "Render Template"}
            </button>
          </div>
          {renderError && (
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
              {getErrorMessage(
                renderError,
                "Failed to render query template.",
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
            color: "#8A857D",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "8px",
          }}
        >
          Generated SQL
        </div>
        <SqlBlock sql={result.sql} safety={result.safety} libraryEntry={selectedLibrary} />
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
              color: "#C9A227",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            Aggregate
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
              color: "#8A857D",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "7px",
            }}
          >
            Tables Referenced
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {result.tables_referenced.map((t) => (
              <span
                key={t}
                style={{
                  padding: "3px 10px",
                  borderRadius: "5px",
                  border: "1px solid #232328",
                  background: "#1C1C20",
                  color: "#C9A227",
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
            background: "#151518",
            border: "1px solid #232328",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#8A857D",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "8px",
            }}
          >
            Explanation
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "#C5C0B8",
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
            background: "#1C1C20",
            color: "#C5C0B8",
            fontSize: "13px",
            fontWeight: 500,
            cursor: validateMutation.isPending ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            transition: "all 150ms",
            opacity: validateMutation.isPending ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!validateMutation.isPending) {
              e.currentTarget.style.background = "#232328";
              e.currentTarget.style.borderColor = "#2DD4BF40";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#1C1C20";
            e.currentTarget.style.borderColor = "#232328";
          }}
        >
          {validateMutation.isPending ? (
            <Loader2
              size={14}
              style={{ animation: "spin 1s linear infinite" }}
            />
          ) : (
            <ShieldCheck size={14} style={{ color: "#2DD4BF" }} />
          )}
          {validateMutation.isPending ? "Validating\u2026" : "Validate SQL"}
        </button>

        {validation && (
          <div
            style={{
              marginTop: "12px",
              background: "#151518",
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
                <ShieldCheck size={15} style={{ color: "#2DD4BF" }} />
              ) : (
                <ShieldAlert size={15} style={{ color: "#F87171" }} />
              )}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: validation.valid ? "#2DD4BF" : "#F87171",
                }}
              >
                {validation.valid ? "Valid SQL" : "Validation Failed"}
              </span>
              {validation.read_only && (
                <span
                  style={{
                    padding: "1px 8px",
                    borderRadius: "20px",
                    border: "1px solid #2DD4BF30",
                    background: "#2DD4BF10",
                    color: "#2DD4BF",
                    fontSize: "11px",
                    fontWeight: 600,
                    marginLeft: "auto",
                  }}
                >
                  Read Only
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
                      background: "#1C1C20",
                      color: "#C5C0B8",
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
                      color: "#C9A227",
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
              color: "#F87171",
              fontSize: "13px",
            }}
          >
            {getErrorMessage(
              validateMutation.error,
              "Failed to validate SQL.",
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
