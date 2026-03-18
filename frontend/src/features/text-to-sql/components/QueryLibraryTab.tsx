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
        border: `1px solid ${active ? "#2DD4BF50" : "#232328"}`,
        background: active ? "#2DD4BF10" : "#151518",
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
            color: "#F0EDE8",
            flex: 1,
          }}
        >
          {entry.name}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "#8A857D",
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
          color: "#8A857D",
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
              background: "#1C1C20",
              border: "1px solid #232328",
              color: "#C9A227",
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
          background: "#151518",
          border: "1px solid #232328",
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
              color: "#8A857D",
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries by keyword\u2026"
            style={{
              width: "100%",
              background: "#0E0E11",
              border: "1px solid #232328",
              borderRadius: "8px",
              padding: "10px 14px 10px 36px",
              color: "#F0EDE8",
              fontSize: "14px",
              boxSizing: "border-box",
              outline: "none",
              transition: "border-color 150ms",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#9B1B30";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#232328";
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
                background: "#2DD4BF10",
                border: "1px solid #2DD4BF30",
                color: "#2DD4BF",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {meta?.indexed_total ?? 0} indexed queries
            </span>
            <span style={{ fontSize: "11px", color: "#8A857D" }}>
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
                color: "#8A857D",
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
                border: `1px solid ${domain === "all" ? "#C9A22755" : "#232328"}`,
                background: domain === "all" ? "#C9A22718" : "#1C1C20",
                color: domain === "all" ? "#C9A227" : "#8A857D",
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
                  border: `1px solid ${domain === item.domain ? "#C9A22755" : "#232328"}`,
                  background:
                    domain === item.domain ? "#C9A22718" : "#1C1C20",
                  color: domain === item.domain ? "#C9A227" : "#8A857D",
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
            border: "1px solid #9B1B3040",
            background: "#9B1B3015",
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
                border: "1px dashed #232328",
                background: "#111115",
                color: "#8A857D",
                fontSize: "13px",
                lineHeight: "1.5",
                textAlign: "center",
              }}
            >
              <Database
                size={20}
                style={{ color: "#8A857D", marginBottom: "8px" }}
              />
              <div>No queries found matching your search.</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>
                Try a different keyword or clear your filters.
              </div>
              <div style={{ fontSize: "11px", marginTop: "8px", color: "#5A5650" }}>
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
                border: "1px solid #232328",
                background: "#1C1C20",
                color: "#C5C0B8",
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
