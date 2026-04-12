import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Play, Clock, Trash2, MessageSquareCode } from "lucide-react";
import { generateSql, type GenerateResponse } from "../api";
import { ResultsPanel } from "./ResultsPanel";
import { ResultsSkeleton } from "./ResultsSkeleton";
import { SchemaBrowser } from "./SchemaBrowser";
import { getErrorMessage } from "@/lib/error-utils";

// ── Local storage helpers ────────────────────────────────────────────────────

const HISTORY_KEY = "parthenon:query-assistant:history";
const MAX_HISTORY = 10;

interface HistoryEntry {
  id: string;
  question: string;
  sql: string;
  timestamp: number;
  explanation?: string;
  tables_referenced?: string[];
  is_aggregate?: boolean;
  safety?: string;
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(entries.slice(0, MAX_HISTORY)),
  );
}

const EXAMPLE_QUESTIONS = [
  "How many patients have diabetes?",
  "What are the top 10 conditions by prevalence?",
  "Average age of patients with heart failure",
  "Drug exposure counts for statins in 2024",
];

export function NaturalLanguageTab() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const generateMutation = useMutation({
    mutationFn: generateSql,
    onMutate: () => {
      setResult(null);
    },
    onSuccess: (data) => {
      setResult(data);
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        question,
        sql: data.sql,
        timestamp: Date.now(),
        explanation: data.explanation,
        tables_referenced: data.tables_referenced,
        is_aggregate: data.is_aggregate,
        safety: data.safety,
      };
      setHistory((prev) => {
        const updated = [entry, ...prev].slice(0, MAX_HISTORY);
        saveHistory(updated);
        return updated;
      });
    },
  });

  const handleGenerate = useCallback(() => {
    if (!question.trim()) return;
    generateMutation.mutate({ question: question.trim() });
  }, [question, generateMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    setQuestion(entry.question);
    setResult({
      sql: entry.sql,
      explanation: entry.explanation ?? "",
      tables_referenced: entry.tables_referenced ?? [],
      is_aggregate: entry.is_aggregate ?? false,
      safety: (entry.safety ?? "safe") as "safe" | "unsafe" | "unknown",
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const isLoading = generateMutation.isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Input + results layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
          gap: "24px",
          alignItems: "start",
        }}
        className="nl-grid"
      >
        {/* Left: input + history */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {/* Input card */}
          <div
            style={{
              background: "var(--surface-raised)",
              border: "1px solid #232328",
              borderRadius: "10px",
              padding: "20px",
            }}
          >
            <label
              htmlFor="nl-question"
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "10px",
                letterSpacing: "0.2px",
              }}
            >
              Ask a Question
            </label>

            <textarea
              id="nl-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. How many patients were diagnosed with type 2 diabetes in 2023?"
              rows={4}
              style={{
                width: "100%",
                background: "var(--surface-base)",
                border: "1px solid #232328",
                borderRadius: "8px",
                padding: "12px 14px",
                color: "var(--text-primary)",
                fontSize: "14px",
                lineHeight: "1.6",
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 150ms",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--surface-elevated)";
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "4px",
              }}
            >
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Ctrl+Enter to generate
              </span>
            </div>

            {/* Example chips */}
            <div style={{ marginTop: "14px" }}>
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
                Try an example
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
              >
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuestion(q)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "20px",
                      border: "1px solid #2DD4BF30",
                      background: "#2DD4BF0A",
                      color: "var(--success)",
                      fontSize: "11px",
                      cursor: "pointer",
                      transition: "all 150ms",
                      whiteSpace: "nowrap",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#2DD4BF18";
                      e.currentTarget.style.borderColor = "#2DD4BF60";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#2DD4BF0A";
                      e.currentTarget.style.borderColor = "#2DD4BF30";
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={!question.trim() || isLoading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "16px",
                padding: "10px 22px",
                borderRadius: "8px",
                border: "none",
                background:
                  isLoading || !question.trim() ? "#4A1020" : "var(--primary)",
                color:
                  isLoading || !question.trim() ? "#C5C0B855" : "var(--text-primary)",
                fontSize: "14px",
                fontWeight: 600,
                cursor:
                  isLoading || !question.trim() ? "not-allowed" : "pointer",
                transition: "background 150ms",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (!isLoading && question.trim()) {
                  e.currentTarget.style.background = "#B52238";
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && question.trim()) {
                  e.currentTarget.style.background = "var(--primary)";
                }
              }}
            >
              {isLoading ? (
                <Loader2
                  size={16}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Play size={15} />
              )}
              {isLoading ? "Generating\u2026" : "Generate With AI"}
            </button>

            {generateMutation.isError && (
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
                  generateMutation.error,
                  "Failed to generate SQL. Please try again.",
                )}
              </div>
            )}
          </div>

          {/* Query History */}
          {history.length > 0 && (
            <div
              style={{
                background: "var(--surface-raised)",
                border: "1px solid #232328",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid #232328",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                  }}
                >
                  <Clock size={14} style={{ color: "var(--text-muted)" }} />
                  Query History
                </div>
                <button
                  onClick={handleClearHistory}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 8px",
                    borderRadius: "5px",
                    border: "1px solid #232328",
                    background: "none",
                    color: "var(--text-muted)",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--critical)";
                    e.currentTarget.style.borderColor = "#9B1B3040";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.borderColor = "var(--surface-elevated)";
                  }}
                >
                  <Trash2 size={11} />
                  Clear
                </button>
              </div>

              <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                {history.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleHistoryClick(entry)}
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                      padding: "10px 16px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid #232328",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "background 150ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surface-overlay)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "none";
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                        width: "100%",
                      }}
                    >
                      {entry.question}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: results */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {isLoading && <ResultsSkeleton />}

          {!isLoading && result && (
            <ResultsPanel
              result={result}
              selectedLibrary={null}
              libraryParams={{}}
              onLibraryParamChange={() => {}}
              onRerenderLibrary={() => {}}
              isRenderPending={false}
              renderError={null}
            />
          )}

          {!isLoading && !result && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "14px",
                padding: "60px 24px",
                border: "1px dashed #232328",
                borderRadius: "10px",
                background: "var(--surface-raised)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "12px",
                  background: "rgba(155, 27, 48, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageSquareCode
                  size={24}
                  style={{ color: "var(--primary)" }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Ask a question to get started
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-muted)",
                    margin: 0,
                    maxWidth: "320px",
                  }}
                >
                  Type a natural language question about your OMOP CDM data
                  and the AI will generate the corresponding SQL query.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schema browser */}
      <SchemaBrowser />

      {/* Responsive + animations */}
      <style>{`
        @media (max-width: 900px) {
          .nl-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
