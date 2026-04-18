import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/i18n/format";
import type { ChartAnnotation } from "../../../types/ares";

interface AnnotationTimelineProps {
  annotations: ChartAnnotation[];
}

const TAG_COLORS: Record<string, string> = {
  data_event: "border-success bg-success/10 text-success",
  research_note: "border-accent bg-accent/10 text-accent",
  action_item: "border-critical bg-critical/10 text-critical",
  system: "border-info bg-info/10 text-domain-observation",
};

export default function AnnotationTimeline({ annotations }: AnnotationTimelineProps) {
  const { t } = useTranslation("app");
  const sorted = [...annotations].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-text-ghost">
        {t("dataExplorer.ares.annotations.empty.noTimeline")}
      </div>
    );
  }

  return (
    <div className="relative ml-4 border-l border-border-subtle pl-6">
      {sorted.map((ann) => (
        <div key={ann.id} className="relative mb-6">
          {/* Timeline dot */}
          <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-border-subtle bg-accent" />

          <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-text-ghost">
                {formatDateTime(ann.created_at)}
              </span>
              {ann.tag && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    TAG_COLORS[ann.tag] ?? "border-border-default text-text-muted"
                  }`}
                >
                  {t(`dataExplorer.ares.annotations.tags.${ann.tag}`, {
                    defaultValue: ann.tag,
                  })}
                </span>
              )}
              <span className="text-xs text-text-ghost">{ann.chart_type}</span>
            </div>
            <p className="text-sm text-text-secondary">{ann.annotation_text}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-text-ghost">
              <span>{ann.creator?.name ?? t("dataExplorer.ares.annotations.tags.system")}</span>
              {ann.source?.source_name && (
                <span>
                  {t("dataExplorer.ares.annotations.sourceContext", {
                    source: ann.source.source_name,
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
