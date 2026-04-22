import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchSchema, type SchemaTable } from "../api";

function SchemaTableRow({ table }: { table: SchemaTable }) {
  const { t } = useTranslation("app");
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid var(--border-default)" }}>
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
          color: "var(--text-secondary)",
          transition: "background 150ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-overlay)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "none";
        }}
      >
        {open ? (
          <ChevronDown
            size={14}
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          />
        ) : (
          <ChevronRight
            size={14}
            style={{ color: "var(--text-muted)", flexShrink: 0 }}
          />
        )}
        <Database size={13} style={{ color: "var(--success)", flexShrink: 0 }} />
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "13px",
            fontWeight: 500,
            flex: 1,
          }}
        >
          {table.name}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          {t("queryAssistant.schemaBrowser.cols", {
            count: table.columns.length,
          })}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px 36px" }}>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              marginBottom: "8px",
              lineHeight: "1.5",
            }}
          >
            {table.description || t("queryAssistant.schemaBrowser.noDescription")}
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
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
                  background: "var(--surface-base)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: "var(--accent)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.name}
                </span>
                <span
                  style={{
                    color: "var(--success)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "11px",
                  }}
                >
                  {col.type}
                </span>
                <span
                  style={{
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
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

export function SchemaBrowser() {
  const { t } = useTranslation("app");
  const [open, setOpen] = useState(false);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["text-to-sql-schema"],
    queryFn: fetchSchema,
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "8px",
        overflow: "hidden",
        background: "var(--surface-raised)",
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
          color: "var(--text-secondary)",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <Database size={15} style={{ color: "var(--success)" }} />
        {t("queryAssistant.schemaBrowser.title")}
        {isFetching && (
          <Loader2
            size={13}
            style={{
              marginLeft: "auto",
              color: "var(--text-muted)",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--border-default)" }}>
          {isError && (
            <div
              style={{ padding: "16px", color: "var(--primary)", fontSize: "13px" }}
            >
              {t("queryAssistant.schemaBrowser.failedToLoad")}
            </div>
          )}

          {data && (
            <>
              <div
                style={{
                  padding: "6px 14px",
                  background: "var(--surface-base)",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                {t("queryAssistant.schemaBrowser.clinicalTables", {
                  count: data.clinical_tables.length,
                })}
              </div>
              {data.clinical_tables.map((t) => (
                <SchemaTableRow key={t.name} table={t} />
              ))}

              <div
                style={{
                  padding: "6px 14px",
                  background: "var(--surface-base)",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  borderTop: "1px solid var(--border-default)",
                }}
              >
                {t("queryAssistant.schemaBrowser.vocabularyTables", {
                  count: data.vocabulary_tables.length,
                })}
              </div>
              {data.vocabulary_tables.map((t) => (
                <SchemaTableRow key={t.name} table={t} />
              ))}

              {data.common_joins.length > 0 && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderTop: "1px solid var(--border-default)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "8px",
                    }}
                  >
                    {t("queryAssistant.schemaBrowser.commonJoins")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {data.common_joins.map((join, i) => (
                      <div
                        key={i}
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          background: "var(--surface-base)",
                          padding: "6px 10px",
                          borderRadius: "4px",
                          border: "1px solid var(--border-default)",
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
