import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";

export function SqlBlock({ sql }: { sql: string }) {
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
              fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
              letterSpacing: "0.5px",
            }}
          >
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
