import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";
import { searchConcepts } from "@/features/vocabulary/api/vocabularyApi";
import type { Concept } from "@/features/vocabulary/types/vocabulary";

type ScopedConcept = Concept & { observation_count?: number };

interface ConceptSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  paramType?: string;
  placeholder?: string;
  /**
   * Optional source_key — when provided, search is scoped to concepts that
   * actually have observations in that source's stratified_code_counts table
   * (via /api/v1/finngen/code-explorer/concepts). Without it, falls back to
   * the global vocabulary search.
   */
  sourceKey?: string | null;
}

export function ConceptSearchInput({
  value,
  onChange,
  paramType,
  placeholder,
  sourceKey,
}: ConceptSearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<ScopedConcept[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        if (sourceKey) {
          const { data } = await apiClient.get<{ items: ScopedConcept[] }>(
            "/finngen/code-explorer/concepts",
            { params: { source: sourceKey, q: query, limit: 15 } },
          );
          setSuggestions(data.items ?? []);
          setShowDropdown((data.items ?? []).length > 0);
        } else {
          const result = await searchConcepts({
            q: query,
            standard: true,
            limit: 8,
          });
          setSuggestions(result.items);
          setShowDropdown(result.items.length > 0);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [sourceKey],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (concept: Concept) => {
    // If the param expects a number (concept_id), use the ID; otherwise use the name
    const isIdParam =
      paramType === "number" ||
      /concept.?id|_id$/i.test(placeholder ?? "");
    const selected = isIdParam
      ? String(concept.concept_id)
      : concept.concept_name;

    setInputValue(selected);
    onChange(selected);
    setShowDropdown(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Search
          size={13}
          style={{
            position: "absolute",
            left: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={(e) => {
            if (suggestions.length > 0) setShowDropdown(true);
            e.currentTarget.style.borderColor = "var(--primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--surface-elevated)";
          }}
          placeholder={placeholder}
          style={{
            width: "100%",
            background: "var(--surface-base)",
            border: "1px solid #232328",
            borderRadius: "8px",
            padding: "10px 12px 10px 32px",
            color: "var(--text-primary)",
            fontSize: "13px",
            boxSizing: "border-box",
            outline: "none",
            transition: "border-color 150ms",
          }}
        />
        {isSearching && (
          <Loader2
            size={13}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              animation: "spin 1s linear infinite",
            }}
          />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 100,
            marginTop: "4px",
            background: "var(--surface-raised)",
            border: "1px solid #232328",
            borderRadius: "8px",
            overflow: "hidden",
            maxHeight: "240px",
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {suggestions.map((concept) => (
            <button
              key={concept.concept_id}
              onClick={() => handleSelect(concept)}
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                padding: "8px 12px",
                background: "none",
                border: "none",
                borderBottom: "1px solid #1C1C20",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-overlay)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    flex: 1,
                  }}
                >
                  {concept.concept_name}
                </span>
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "11px",
                    color: "var(--success)",
                    flexShrink: 0,
                  }}
                >
                  {concept.concept_id}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                }}
              >
                <span>{concept.domain_id}</span>
                <span>\u00b7</span>
                <span>{concept.vocabulary_id}</span>
                {concept.concept_code && (
                  <>
                    <span>\u00b7</span>
                    <span>{concept.concept_code}</span>
                  </>
                )}
                {typeof concept.observation_count === "number" && (
                  <>
                    <span>\u00b7</span>
                    <span style={{ color: "var(--success)" }}>
                      {concept.observation_count.toLocaleString()} obs
                    </span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
