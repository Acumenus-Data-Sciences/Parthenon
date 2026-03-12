import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  MessageSquareCode,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Loader2,
  Clock,
  Trash2,
  Play,
  Database,
  Zap,
} from "lucide-react";
import {
  generateSql,
  validateSql,
  fetchSchema,
  type GenerateResponse,
  type ValidateResponse,
  type SchemaTable,
} from "../api";

// ── Local storage helpers ─────────────────────────────────────────────────────

const HISTORY_KEY = "parthenon:query-assistant:history";
const MAX_HISTORY = 10;

interface HistoryEntry {
  id: string;
  question: string;
  sql: string;
  timestamp: number;
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
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

// ── Example questions ─────────────────────────────────────────────────────────

const EXAMPLE_QUESTIONS = [
  "How many patients have diabetes?",
  "What are the top 10 conditions by prevalence?",
  "Average age of patients with heart failure",
  "Drug exposure counts for statins in 2024",
];

// ── Complexity badge ──────────────────────────────────────────────────────────

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

// ── SQL block with copy button ────────────────────────────────────────────────

function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sql]);

  return (
    <div className="relative">
      <div
        style={{
          background: "#0A0A0D",
          border: "1px solid #232328",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {/* Toolbar row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            borderBottom: "1px solid #232328",
            background: "#111115",
          }}
        >
          <span style={{ fontSize: "11px", color: "#8A857D", fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", letterSpacing: "0.5px" }}>
            SQL
          </span>
          <button
            onClick={handleCopy}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 10px",
              borderRadius: "5px",
              border: "1px solid #232328",
              background: copied ? "#2DD4BF10" : "#1C1C20",
              color: copied ? "#2DD4BF" : "#8A857D",
              fontSize: "12px",
              cursor: "pointer",
              transition: "all 150ms",
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* Code area */}
        <pre
          style={{
            margin: 0,
            padding: "16px",
            fontFamily: "'IBM Plex Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: "13px",
            lineHeight: "1.65",
            color: "#C5C0B8",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <code>{sql}</code>
        </pre>
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function ResultsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* SQL skeleton */}
      <div
        style={{
          background: "#0A0A0D",
          border: "1px solid #232328",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "8px 14px", borderBottom: "1px solid #232328", background: "#111115", height: "36px" }} />
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {[80, 65, 90, 55, 72].map((w, i) => (
            <div
              key={i}
              style={{
                height: "14px",
                borderRadius: "4px",
                width: `${w}%`,
                background: "linear-gradient(90deg, #1C1C20 25%, #232328 50%, #1C1C20 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              }}
            />
          ))}
        </div>
      </div>

      {/* Explanation skeleton */}
      <div
        style={{
          background: "#151518",
          border: "1px solid #232328",
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {[100, 85, 60].map((w, i) => (
          <div
            key={i}
            style={{
              height: "12px",
              borderRadius: "4px",
              width: `${w}%`,
              background: "linear-gradient(90deg, #1C1C20 25%, #232328 50%, #1C1C20 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── Schema browser (collapsible) ──────────────────────────────────────────────

function SchemaTableRow({ table }: { table: SchemaTable }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid #232328" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "#C5C0B8",
          transition: "background 150ms",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#1C1C20"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
      >
        {open ? <ChevronDown size={14} style={{ color: "#8A857D", flexShrink: 0 }} /> : <ChevronRight size={14} style={{ color: "#8A857D", flexShrink: 0 }} />}
        <Database size={13} style={{ color: "#2DD4BF", flexShrink: 0 }} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", fontWeight: 500, flex: 1 }}>
          {table.name}
        </span>
        <span style={{ fontSize: "11px", color: "#8A857D" }}>
          {table.columns.length} cols
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px 36px" }}>
          <p style={{ fontSize: "12px", color: "#8A857D", marginBottom: "8px", lineHeight: "1.5" }}>
            {table.description}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {table.columns.map((col) => (
              <div
                key={col.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 90px 1fr",
                  gap: "8px",
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: "#0A0A0D",
                }}
              >
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#C9A227", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {col.name}
                </span>
                <span style={{ color: "#2DD4BF", fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px" }}>
                  {col.type}
                </span>
                <span style={{ color: "#8A857D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {col.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SchemaBrowser() {
  const [open, setOpen] = useState(false);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["text-to-sql-schema"],
    queryFn: fetchSchema,
    enabled: open,
    staleTime: 10 * 60 * 1000, // 10 min
  });

  return (
    <div
      style={{
        border: "1px solid #232328",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#151518",
      }}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#C5C0B8",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <Database size={15} style={{ color: "#2DD4BF" }} />
        OMOP CDM Schema Browser
        {isFetching && <Loader2 size={13} style={{ marginLeft: "auto", color: "#8A857D", animation: "spin 1s linear infinite" }} />}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #232328" }}>
          {isError && (
            <div style={{ padding: "16px", color: "#9B1B30", fontSize: "13px" }}>
              Failed to load schema.
            </div>
          )}

          {data && (
            <>
              <div style={{ padding: "6px 14px", background: "#111115", fontSize: "11px", color: "#8A857D", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Clinical Tables ({data.clinical_tables.length})
              </div>
              {data.clinical_tables.map((t) => (
                <SchemaTableRow key={t.name} table={t} />
              ))}

              <div style={{ padding: "6px 14px", background: "#111115", fontSize: "11px", color: "#8A857D", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", borderTop: "1px solid #232328" }}>
                Vocabulary Tables ({data.vocabulary_tables.length})
              </div>
              {data.vocabulary_tables.map((t) => (
                <SchemaTableRow key={t.name} table={t} />
              ))}

              {data.common_joins.length > 0 && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid #232328" }}>
                  <div style={{ fontSize: "11px", color: "#8A857D", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                    Common Joins
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {data.common_joins.map((join, i) => (
                      <div
                        key={i}
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: "11px",
                          color: "#C5C0B8",
                          background: "#0A0A0D",
                          padding: "6px 10px",
                          borderRadius: "4px",
                          border: "1px solid #232328",
                        }}
                      >
                        {join}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QueryAssistantPage() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  // Generate SQL mutation
  const generateMutation = useMutation({
    mutationFn: generateSql,
    onSuccess: (data) => {
      setResult(data);
      setValidation(null);

      // Persist to history
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        question,
        sql: data.sql,
        timestamp: Date.now(),
      };
      const updated = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(updated);
      saveHistory(updated);
    },
  });

  // Validate SQL mutation
  const validateMutation = useMutation({
    mutationFn: ({ sql, schema }: { sql: string; schema?: string }) =>
      validateSql(sql, schema),
    onSuccess: (data) => {
      setValidation(data);
    },
  });

  const handleGenerate = useCallback(() => {
    if (!question.trim()) return;
    generateMutation.mutate({ question: question.trim() });
  }, [question, generateMutation]);

  const handleExampleClick = useCallback((q: string) => {
    setQuestion(q);
  }, []);

  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    setQuestion(entry.question);
    setResult({
      sql: entry.sql,
      explanation: "",
      tables_referenced: [],
      is_aggregate: false,
      safety: "safe",
    });
    setValidation(null);
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const handleValidate = useCallback(() => {
    if (!result?.sql) return;
    validateMutation.mutate({ sql: result.sql });
  }, [result, validateMutation]);

  // Enter key submits
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  const isLoading = generateMutation.isPending;

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "#9B1B30/20",
            backgroundColor: "rgba(155, 27, 48, 0.18)",
            flexShrink: 0,
          }}
        >
          <MessageSquareCode size={22} style={{ color: "#9B1B30" }} />
        </div>
        <div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "#F0EDE8",
              margin: 0,
            }}
          >
            Query Assistant
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#8A857D",
              margin: "2px 0 0",
            }}
          >
            Ask questions about your clinical data in plain English
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)",
          gap: "24px",
          alignItems: "start",
        }}
        className="query-assistant-grid"
      >
        {/* ── LEFT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Input card */}
          <div
            style={{
              background: "#151518",
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
                color: "#C5C0B8",
                marginBottom: "10px",
                letterSpacing: "0.2px",
              }}
            >
              Natural Language Question
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
                background: "#0E0E11",
                border: "1px solid #232328",
                borderRadius: "8px",
                padding: "12px 14px",
                color: "#F0EDE8",
                fontSize: "14px",
                lineHeight: "1.6",
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 150ms",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#9B1B30"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#232328"; }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "4px",
              }}
            >
              <span style={{ fontSize: "11px", color: "#8A857D" }}>
                Ctrl+Enter to generate
              </span>
            </div>

            {/* Example question chips */}
            <div style={{ marginTop: "14px" }}>
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
                Try an example
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleExampleClick(q)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "20px",
                      border: "1px solid #2DD4BF30",
                      background: "#2DD4BF0A",
                      color: "#2DD4BF",
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
                background: isLoading || !question.trim() ? "#4A1020" : "#9B1B30",
                color: isLoading || !question.trim() ? "#C5C0B855" : "#F0EDE8",
                fontSize: "14px",
                fontWeight: 600,
                cursor: isLoading || !question.trim() ? "not-allowed" : "pointer",
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
                  e.currentTarget.style.background = "#9B1B30";
                }
              }}
            >
              {isLoading ? (
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Play size={15} />
              )}
              {isLoading ? "Generating…" : "Generate SQL"}
            </button>

            {generateMutation.isError && (
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
                Failed to generate SQL. Please try again.
              </div>
            )}
          </div>

          {/* Query History */}
          {history.length > 0 && (
            <div
              style={{
                background: "#151518",
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
                    color: "#C5C0B8",
                  }}
                >
                  <Clock size={14} style={{ color: "#8A857D" }} />
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
                    color: "#8A857D",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 150ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#F87171"; e.currentTarget.style.borderColor = "#9B1B3040"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#8A857D"; e.currentTarget.style.borderColor = "#232328"; }}
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
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#1C1C20"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        color: "#C5C0B8",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                        width: "100%",
                      }}
                    >
                      {entry.question}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#8A857D",
                      }}
                    >
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Loading skeleton */}
          {isLoading && <ResultsSkeleton />}

          {/* Results */}
          {!isLoading && result && (
            <>
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
                <SqlBlock sql={result.sql} />
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
                {/* Safety badge */}
                {result.safety === "safe" ? (
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
                ) : (
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
                )}

                {/* Aggregate badge */}
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

              {/* Validate button + validation results */}
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
                    <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <ShieldCheck size={14} style={{ color: "#2DD4BF" }} />
                  )}
                  {validateMutation.isPending ? "Validating…" : "Validate SQL"}
                </button>

                {/* Validation results panel */}
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
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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

                    {/* Complexity */}
                    <ComplexityBadge level={validation.estimated_complexity} />

                    {/* Tables */}
                    {validation.tables.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
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

                    {/* Warnings */}
                    {validation.warnings.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
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
              </div>

              {/* Schema browser */}
              <SchemaBrowser />
            </>
          )}

          {/* Empty state */}
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
                background: "#151518",
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
                <MessageSquareCode size={24} style={{ color: "#9B1B30" }} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#C5C0B8",
                    marginBottom: "6px",
                  }}
                >
                  Ask a question to get started
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#8A857D",
                    margin: 0,
                    maxWidth: "320px",
                  }}
                >
                  Type a natural language question about your OMOP CDM data and the AI will generate the corresponding SQL query.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Responsive style override */}
      <style>{`
        @media (max-width: 900px) {
          .query-assistant-grid {
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
