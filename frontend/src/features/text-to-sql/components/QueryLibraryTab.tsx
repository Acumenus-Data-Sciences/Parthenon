import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Database, Search } from "lucide-react";
import {
  searchQueryLibrary,
  renderQueryLibraryEntry,
  type GenerateResponse,
  type QueryLibraryEntry,
  type QueryLibraryParameter,
} from "../api";
import { ResultsPanel } from "./ResultsPanel";
import { SchemaBrowser } from "./SchemaBrowser";

function QueryLibraryCard({
  entry,
  active,
  onSelect,
}: {
  entry: QueryLibraryEntry;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "8px",
        padding: "12px 14px",
        borderRadius: "8px",
        border: `1px solid ${active ? "color-mix(in srgb, var(--success) 31%, transparent)" : "var(--surface-elevated)"}`,
        background: active ? "color-mix(in srgb, var(--success) 6%, transparent)" : "var(--surface-raised)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 150ms",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--text-primary)",
            flex: 1,
          }}
        >
          {entry.name}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {entry.domain}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "12px",
          color: "var(--text-muted)",
          lineHeight: "1.5",
        }}
      >
        {entry.summary}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {entry.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            style={{
              padding: "2px 8px",
              borderRadius: "999px",
              background: "var(--surface-overlay)",
              border: "1px solid var(--surface-elevated)",
              color: "var(--accent)",
              fontSize: "11px",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

export function QueryLibraryTab({ dialect = "postgresql" }: { dialect?: string }) {
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [limit, setLimit] = useState(12);
  const [selectedLibrary, setSelectedLibrary] =
    useState<QueryLibraryEntry | null>(null);
  const [libraryParams, setLibraryParams] = useState<Record<string, string>>(
    {},
  );
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const libraryQuery = useQuery({
    queryKey: ["query-library", search.trim(), domain, limit],
    queryFn: () =>
      searchQueryLibrary({
        q: search.trim() || undefined,
        domain: domain === "all" ? undefined : domain,
        limit,
      }),
    staleTime: 60 * 1000,
  });

  const renderMutation = useMutation({
    mutationFn: ({
      id,
      params,
    }: {
      id: number;
      params: Record<string, string>;
    }) => renderQueryLibraryEntry(id, { dialect, params }),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleSelect = useCallback(
    (entry: QueryLibraryEntry) => {
      setSelectedLibrary(entry);
      const defaults = Object.fromEntries(
        (entry.parameters ?? []).map((p) => [p.key, p.default ?? ""]),
      );
      setLibraryParams(defaults);
      renderMutation.mutate({ id: entry.id, params: defaults });
    },
    [renderMutation],
  );

  const handleParamChange = useCallback(
    (param: QueryLibraryParameter, value: string) => {
      setLibraryParams((prev) => ({ ...prev, [param.key]: value }));
    },
    [],
  );

  const handleRerender = useCallback(() => {
    if (!selectedLibrary) return;
    renderMutation.mutate({ id: selectedLibrary.id, params: libraryParams });
  }, [libraryParams, renderMutation, selectedLibrary]);

  const entries = libraryQuery.data?.data ?? [];
  const meta = libraryQuery.data?.meta;
  const hasMore = (meta?.total ?? 0) > entries.length && limit < 20;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Search + filters */}
      <div
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--surface-elevated)",
          borderRadius: "10px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Search input */}
        <div style={{ position: "relative" }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries by keyword\u2026"
            style={{
              width: "100%",
              background: "var(--surface-base)",
              border: "1px solid var(--surface-elevated)",
              borderRadius: "8px",
              padding: "10px 14px 10px 36px",
              color: "var(--text-primary)",
              fontSize: "14px",
              boxSizing: "border-box",
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--surface-elevated)";
            }}
          />
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "4px 9px",
                borderRadius: "999px",
                background: "color-mix(in srgb, var(--success) 6%, transparent)",
                border: "1px solid var(--success)30",
                color: "var(--success)",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {meta?.indexed_total ?? 0} indexed queries
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {search.trim()
                ? `${meta?.total ?? 0} matches`
                : `${meta?.count ?? 0} featured templates`}
            </span>
          </div>
          {libraryQuery.isFetching && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "var(--text-muted)",
              }}
            >
              <Loader2
                size={12}
                style={{ animation: "spin 1s linear infinite" }}
              />
              Refreshing
            </span>
          )}
        </div>

        {/* Domain pills */}
        {(meta?.domain_counts?.length ?? 0) > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <button
              onClick={() => setDomain("all")}
              style={{
                padding: "5px 10px",
                borderRadius: "999px",
                border: `1px solid ${domain === "all" ? "color-mix(in srgb, var(--accent) 33%, transparent)" : "var(--surface-elevated)"}`,
                background: domain === "all" ? "color-mix(in srgb, var(--accent) 9%, transparent)" : "var(--surface-overlay)",
                color: domain === "all" ? "var(--accent)" : "var(--text-muted)",
                fontSize: "11px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              All domains
            </button>
            {meta?.domain_counts.slice(0, 8).map((item) => (
              <button
                key={item.domain}
                onClick={() => setDomain(item.domain)}
                style={{
                  padding: "5px 10px",
                  borderRadius: "999px",
                  border: `1px solid ${domain === item.domain ? "color-mix(in srgb, var(--accent) 33%, transparent)" : "var(--surface-elevated)"}`,
                  background:
                    domain === item.domain ? "color-mix(in srgb, var(--accent) 9%, transparent)" : "var(--surface-overlay)",
                  color: domain === item.domain ? "var(--accent)" : "var(--text-muted)",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textTransform: "none",
                }}
              >
                {item.domain} ({item.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {libraryQuery.isError && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "6px",
            border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
            background: "color-mix(in srgb, var(--primary) 8%, transparent)",
            color: "#F87171",
            fontSize: "12px",
          }}
        >
          Failed to load query library.
        </div>
      )}

      {/* Cards grid + detail panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: result
            ? "minmax(0, 1fr) minmax(0, 1fr)"
            : "1fr",
          gap: "20px",
          alignItems: "start",
        }}
        className="library-grid"
      >
        {/* Cards column — always 3-col grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px",
            alignItems: "start",
          }}
          className="library-cards-grid"
        >
          {entries.map((entry) => (
            <QueryLibraryCard
              key={entry.id}
              entry={entry}
              active={selectedLibrary?.id === entry.id}
              onSelect={() => handleSelect(entry)}
            />
          ))}

          {!libraryQuery.isLoading && entries.length === 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "24px",
                borderRadius: "8px",
                border: "1px dashed var(--surface-elevated)",
                background: "#111115",
                color: "var(--text-muted)",
                fontSize: "13px",
                lineHeight: "1.5",
                textAlign: "center",
              }}
            >
              <Database
                size={20}
                style={{ color: "var(--text-muted)", marginBottom: "8px" }}
              />
              <div>No queries found matching your search.</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>
                Try a different keyword or clear your filters.
              </div>
              <div style={{ fontSize: "11px", marginTop: "8px", color: "var(--text-ghost)" }}>
                If the library is empty, ask your admin to run: php artisan query-library:import-ohdsi
              </div>
            </div>
          )}

          {hasMore && (
            <button
              onClick={() => setLimit((c) => Math.min(c + 8, 20))}
              style={{
                gridColumn: "1 / -1",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid var(--surface-elevated)",
                background: "var(--surface-overlay)",
                color: "var(--text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Show more matches
            </button>
          )}
        </div>

        {/* Detail panel (appears when a card is selected) */}
        {result && (
          <div
            style={{
              position: "sticky",
              top: "16px",
            }}
          >
            <ResultsPanel
              result={result}
              selectedLibrary={selectedLibrary}
              libraryParams={libraryParams}
              onLibraryParamChange={handleParamChange}
              onRerenderLibrary={handleRerender}
              isRenderPending={renderMutation.isPending}
              dialect={dialect}
              renderError={
                renderMutation.isError ? renderMutation.error : null
              }
            />
          </div>
        )}
      </div>

      {/* Schema browser */}
      <SchemaBrowser />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 1200px) {
          .library-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 900px) {
          .library-grid {
            grid-template-columns: 1fr !important;
          }
          .library-cards-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
