import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchSchema, type SchemaTable } from "../api";

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
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#1C1C20";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "none";
        }}
      >
        {open ? (
          <ChevronDown
            size={14}
            style={{ color: "#8A857D", flexShrink: 0 }}
          />
        ) : (
          <ChevronRight
            size={14}
            style={{ color: "#8A857D", flexShrink: 0 }}
          />
        )}
        <Database size={13} style={{ color: "#2DD4BF", flexShrink: 0 }} />
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
        <span style={{ fontSize: "11px", color: "#8A857D" }}>
          {table.columns.length} cols
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px 36px" }}>
          <p
            style={{
              fontSize: "12px",
              color: "#8A857D",
              marginBottom: "8px",
              lineHeight: "1.5",
            }}
          >
            {table.description || "No description available."}
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
                  background: "#0A0A0D",
                }}
              >
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: "#C9A227",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.name}
                </span>
                <span
                  style={{
                    color: "#2DD4BF",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "11px",
                  }}
                >
                  {col.type}
                </span>
                <span
                  style={{
                    color: "#8A857D",
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
        {isFetching && (
          <Loader2
            size={13}
            style={{
              marginLeft: "auto",
              color: "#8A857D",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #232328" }}>
          {isError && (
            <div
              style={{ padding: "16px", color: "#9B1B30", fontSize: "13px" }}
            >
              Failed to load schema.
            </div>
          )}

          {data && (
            <>
              <div
                style={{
                  padding: "6px 14px",
                  background: "#111115",
                  fontSize: "11px",
                  color: "#8A857D",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                Clinical Tables ({data.clinical_tables.length})
              </div>
              {data.clinical_tables.map((t) => (
                <SchemaTableRow key={t.name} table={t} />
              ))}

              <div
                style={{
                  padding: "6px 14px",
                  background: "#111115",
                  fontSize: "11px",
                  color: "#8A857D",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  borderTop: "1px solid #232328",
                }}
              >
                Vocabulary Tables ({data.vocabulary_tables.length})
              </div>
              {data.vocabulary_tables.map((t) => (
                <SchemaTableRow key={t.name} table={t} />
              ))}

              {data.common_joins.length > 0 && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderTop: "1px solid #232328",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#8A857D",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "8px",
                    }}
                  >
                    Common Joins
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
