import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useOpenTargetsSearch } from "../../hooks/useGenomicEvidence";
import { OpenTargetsResults } from "./OpenTargetsResults";

type PinFinding = {
  domain: string;
  section: string;
  finding_type: string;
  finding_payload: Record<string, unknown>;
  gene_symbols?: string[];
};

interface OpenTargetsSearchProps {
  investigationId: number;
  onPinFinding: (finding: PinFinding) => void;
}

export function OpenTargetsSearch({
  investigationId,
  onPinFinding,
}: OpenTargetsSearchProps) {
  const { t } = useTranslation("app");
  const [queryType, setQueryType] = useState<"gene" | "disease">("gene");
  const [inputValue, setInputValue] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  // 500ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue.trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data, isLoading, isError, error } = useOpenTargetsSearch(
    investigationId,
    queryType,
    debouncedTerm,
  );

  const hits = data?.data?.search?.hits ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header + branding */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--accent)" }}
          >
            {t("investigation.common.tabs.openTargets")}
          </span>
          <span className="text-[10px] text-text-ghost">
            {t("investigation.genomic.platform")}
          </span>
        </div>
      </div>

      {/* Query type toggle */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-surface-raised/60 w-fit">
        {(["gene", "disease"] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              setQueryType(type);
              setInputValue("");
              setDebouncedTerm("");
            }}
            className={`text-xs px-3 py-1 rounded-md transition-colors capitalize ${
              queryType === type
                ? "bg-surface-accent text-text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t(`investigation.genomic.${type}`)}
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
            queryType === "gene"
              ? t("investigation.common.placeholders.searchGeneOpenTargets")
              : t("investigation.common.placeholders.searchDiseaseOpenTargets")
          }
          className="w-full text-sm bg-surface-raised/60 border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-ghost focus:outline-none focus:border-border-hover transition-colors"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3.5 h-3.5 border-2 border-border-hover border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* States */}
      {isError && (
        <p className="text-xs text-primary px-1">
          {error instanceof Error
            ? error.message
            : t("investigation.common.messages.searchFailed")}
        </p>
      )}

      {!isLoading && !isError && debouncedTerm.length >= 2 && data && (
        <OpenTargetsResults
          hits={hits}
          queryType={queryType}
          onPinFinding={onPinFinding}
        />
      )}

      {!debouncedTerm && (
        <p className="text-xs text-text-ghost px-1">
          {t("investigation.common.messages.enterAtLeast2Characters")}
        </p>
      )}
    </div>
  );
}
