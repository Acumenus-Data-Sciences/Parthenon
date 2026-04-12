import { useState, useEffect } from "react";
import { useGwasCatalogSearch } from "../../hooks/useGenomicEvidence";
import { GwasCatalogResults } from "./GwasCatalogResults";

type PinFinding = {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
  gene_symbols?: string[];
};

interface GwasCatalogSearchProps {
  investigationId: number;
  onPinFinding: (finding: PinFinding) => void;
}

export function GwasCatalogSearch({
  investigationId,
  onPinFinding,
}: GwasCatalogSearchProps) {
  const [queryType, setQueryType] = useState<"trait" | "gene">("trait");
  const [inputValue, setInputValue] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  // 500ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Reset when query type changes
  useEffect(() => {
    setDebouncedTerm("");
    setInputValue("");
  }, [queryType]);

  const { data, isLoading, isError, error } = useGwasCatalogSearch(
    investigationId,
    queryType,
    debouncedTerm,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Header + branding */}
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--success)" }}
        >
          GWAS Catalog
        </span>
        <span className="text-[10px] text-text-ghost">EMBL-EBI</span>
      </div>

      {/* Query type toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-surface-raised/60 w-fit">
        {(["trait", "gene"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setQueryType(type)}
            className={`text-xs px-3 py-1 rounded-md transition-colors capitalize ${
              queryType === type
                ? "bg-surface-accent text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            queryType === "trait"
              ? "Search trait or phenotype (e.g. type 2 diabetes)"
              : "Search gene (e.g. TCF7L2)"
          }
          className="w-full text-sm bg-surface-raised/60 border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-ghost focus:outline-none focus:border-border-hover transition-colors"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div
              className="w-3.5 h-3.5 border-2 border-border-hover rounded-full animate-spin"
              style={{ borderTopColor: "var(--success)" }}
            />
          </div>
        )}
      </div>

      {/* States */}
      {isError && (
        <p className="text-xs text-primary px-1">
          {error instanceof Error ? error.message : "Search failed. Please try again."}
        </p>
      )}

      {!isLoading && !isError && debouncedTerm.length >= 2 && data && (
        <GwasCatalogResults
          result={data}
          queryType={queryType}
          onPinFinding={onPinFinding}
        />
      )}

      {!debouncedTerm && (
        <p className="text-xs text-text-ghost px-1">
          Enter at least 2 characters to search.
        </p>
      )}
    </div>
  );
}
