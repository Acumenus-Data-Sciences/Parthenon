// ---------------------------------------------------------------------------
// ReportSection — Individual toggleable/reorderable section in the report
// ---------------------------------------------------------------------------

import { ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MethodsSection } from "./MethodsSection";
import { ResultsSummarySection } from "./ResultsSummarySection";
import {
  getPublishAnalysisTypeLabel,
  getPublishSectionTypeLabel,
} from "../lib/i18n";
import type { ReportSection as ReportSectionType } from "../types/publish";

interface ReportSectionProps {
  section: ReportSectionType;
  included: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 * A single report section with header, toggle (include/exclude),
 * up/down reorder buttons, and content preview.
 */
export function ReportSectionCard({
  section,
  included,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
}: ReportSectionProps) {
  const { t } = useTranslation("app");
  return (
    <div
      data-testid={`report-section-${section.id}`}
      className={`rounded-lg border transition-opacity ${
        included
          ? "border-border-default bg-surface-raised"
          : "border-border-default/50 bg-surface-raised/50 opacity-50"
      }`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-3">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-0.5 rounded text-text-primary/40 hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label={t("publish.reportSection.moveUp")}
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className="p-0.5 rounded text-text-primary/40 hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label={t("publish.reportSection.moveDown")}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Title */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {section.title}
            </h3>
            <span className="text-xs text-text-primary/40 capitalize">
              {getPublishSectionTypeLabel(t, section.type)}
              {section.analysisType
                ? ` / ${getPublishAnalysisTypeLabel(t, section.analysisType)}`
                : ""}
            </span>
          </div>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            included
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-critical/15 text-critical hover:bg-critical/25"
          }`}
          aria-label={
            included
              ? t("publish.reportSection.excludeSection")
              : t("publish.reportSection.includeSection")
          }
        >
          {included ? <Eye size={12} /> : <EyeOff size={12} />}
          {included
            ? t("publish.reportSection.included")
            : t("publish.reportSection.excluded")}
        </button>
      </div>

      {/* Content */}
      {included && (
        <div className="px-4 py-3">
          {section.type === "methods" && <MethodsSection section={section} />}
          {section.type === "results" && (
            <ResultsSummarySection section={section} />
          )}
          {section.type === "diagnostics" && (
            <div className="text-sm text-text-primary/50 italic">
              {t("publish.reportSection.diagnosticsPlaceholder")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
