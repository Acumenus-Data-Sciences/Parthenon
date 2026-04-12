import { useState, useCallback } from "react";
import { Copy, Check, Play } from "lucide-react";
import { SqlRunnerModal } from "./SqlRunnerModal";
import type { QueryLibraryEntry } from "../api";

interface SqlBlockProps {
  sql: string;
  safety?: string;
  libraryEntry?: QueryLibraryEntry | null;
  libraryParams?: Record<string, string>;
  dialect?: string;
}

export function SqlBlock({ sql, safety, libraryEntry, libraryParams, dialect }: SqlBlockProps) {
  const [copied, setCopied] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sql]);

  return (
    <>
      <div className="relative">
        <div
          style={{
            background: "#0A0A0D",
            border: "1px solid #232328",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
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
            <span
              style={{
                fontSize: "11px",
                color: "#8A857D",
                fontFamily:
                  "var(--font-mono, 'IBM Plex Mono', monospace)",
                letterSpacing: "0.5px",
              }}
            >
              SQL
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => setRunnerOpen(true)}
                disabled={!sql}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 10px",
                  borderRadius: "5px",
                  border: "1px solid #2DD4BF30",
                  background: "#2DD4BF0A",
                  color: sql ? "#2DD4BF" : "#555",
                  fontSize: "12px",
                  cursor: sql ? "pointer" : "not-allowed",
                  transition: "all 150ms",
                  fontWeight: 600,
                }}
                onMouseEnter={(e) => {
                  if (sql) {
                    e.currentTarget.style.background = "#2DD4BF18";
                    e.currentTarget.style.borderColor = "#2DD4BF60";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#2DD4BF0A";
                  e.currentTarget.style.borderColor = "#2DD4BF30";
                }}
              >
                <Play size={11} />
                Run SQL
              </button>
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
          </div>

          <pre
            style={{
              margin: 0,
              padding: "16px",
              fontFamily:
                "'IBM Plex Mono', 'Fira Code', 'Cascadia Code', monospace",
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

      <SqlRunnerModal
        open={runnerOpen}
        onClose={() => setRunnerOpen(false)}
        sql={sql}
        safety={safety}
        libraryEntry={libraryEntry}
        initialParams={libraryParams}
        dialect={dialect}
      />
    </>
  );
}
