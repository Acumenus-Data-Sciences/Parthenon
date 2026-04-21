// ---------------------------------------------------------------------------
// ReportPreview — Full report preview with toggle and reorder controls
// ---------------------------------------------------------------------------

import { useTranslation } from "react-i18next";
import { ReportSectionCard } from "./ReportSection";
import type { ReportSection } from "../types/publish";

interface ReportPreviewProps {
  sections: ReportSection[];
  onToggle: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
}

/**
 * Renders the full report preview in a white-background "paper" container
 * with toggleable and reorderable sections.
 */
export function ReportPreview({
  sections,
  onToggle,
  onReorder,
}: ReportPreviewProps) {
  const { t } = useTranslation("app");
  return (
    <div data-testid="report-preview" className="space-y-4">
      {/* Paper container */}
      <div
        id="publish-report-preview"
        className="rounded-xl border border-border-default bg-surface-base p-6 shadow-xl"
      >
        {/* Report header */}
        <div className="mb-6 pb-4 border-b border-border-default">
          <h2 className="text-lg font-bold text-text-primary">
            {t("publish.reportPreview.title")}
          </h2>
          <p className="text-xs text-text-primary/40 mt-1">
            {t("publish.reportPreview.subtitle")}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {sections.map((section, index) => (
            <ReportSectionCard
              key={section.id}
              section={section}
              included={section.included}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
              onToggle={() => onToggle(section.id)}
              onMoveUp={() => onReorder(section.id, "up")}
              onMoveDown={() => onReorder(section.id, "down")}
            />
          ))}
        </div>

        {sections.length === 0 && (
          <p className="text-center text-sm text-text-primary/40 py-8">
            {t("publish.reportPreview.empty")}
          </p>
        )}
      </div>
    </div>
  );
}
