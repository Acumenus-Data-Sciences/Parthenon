import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  FileText,
  Download,
  FileType2,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { useStudyManuscript, useExportStudyManuscript } from "../hooks/useStudies";
import type { ManuscriptSection } from "../types/study";

interface StudyManuscriptTabProps {
  slug: string;
  studyId: number;
}

/**
 * Renders the protocol-ordered manuscript composed by the backend
 * ManuscriptComposer (GET /studies/{slug}/manuscript) — the canonical in-study
 * publication view — with docx/pdf export and a hand-off to the publisher.
 */
export function StudyManuscriptTab({ slug, studyId }: StudyManuscriptTabProps) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { data: manuscript, isLoading, error } = useStudyManuscript(slug);
  const exportMutation = useExportStudyManuscript();
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = (format: "docx" | "pdf") => {
    setExportError(null);
    exportMutation.mutate(
      { slug, format },
      { onError: (err) => setExportError(err instanceof Error ? err.message : t("studies.detail.manuscript.exportFailed")) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !manuscript) {
    return (
      <div className="empty-state">
        <AlertTriangle size={24} className="text-warning mb-2" />
        <h3 className="empty-title">{t("studies.detail.manuscript.empty.title")}</h3>
        <p className="empty-message">{t("studies.detail.manuscript.empty.message")}</p>
      </div>
    );
  }

  const meta = manuscript.manuscript_meta;

  return (
    <div className="space-y-5">
      {/* Header / actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-text-primary">{manuscript.title}</h2>
          {manuscript.authors.length > 0 && (
            <p className="text-sm text-text-muted mt-0.5">{manuscript.authors.join(", ")}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-surface-elevated text-[10px] uppercase tracking-wider text-text-ghost">
              {manuscript.template}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                meta.effect_estimates_included ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              }`}
            >
              <ShieldCheck size={11} />
              {meta.effect_estimates_included
                ? t("studies.detail.manuscript.meta.effectsIncluded")
                : t("studies.detail.manuscript.meta.effectsWithheld")}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-info/10 text-[10px] font-medium text-info">
              {t("studies.detail.manuscript.meta.contrasts", { count: meta.estimation_contrasts })}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-elevated text-[10px] font-medium text-text-muted">
              {meta.gating_enabled
                ? t("studies.detail.manuscript.meta.gatingOn")
                : t("studies.detail.manuscript.meta.gatingOff")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => handleExport("docx")}
            disabled={exportMutation.isPending}
            className="btn btn-secondary btn-sm flex items-center gap-1"
          >
            {exportMutation.isPending && exportMutation.variables?.format === "docx" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {t("studies.detail.manuscript.actions.docx")}
          </button>
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            disabled={exportMutation.isPending}
            className="btn btn-secondary btn-sm flex items-center gap-1"
          >
            {exportMutation.isPending && exportMutation.variables?.format === "pdf" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileType2 size={14} />
            )}
            {t("studies.detail.manuscript.actions.pdf")}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/publish?studyId=${studyId}`)}
            className="btn btn-ghost btn-sm flex items-center gap-1"
            title={t("studies.detail.manuscript.actions.openPublisherTitle")}
          >
            <ExternalLink size={14} />
            {t("studies.detail.manuscript.actions.openPublisher")}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="rounded-lg border border-critical/30 bg-critical/10 p-3 text-sm text-critical">
          {exportError}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {manuscript.sections
          .filter((section) => section.included)
          .map((section) => (
            <ManuscriptSectionView key={section.key} section={section} />
          ))}
      </div>
    </div>
  );
}

function ManuscriptSectionView({ section }: { section: ManuscriptSection }) {
  return (
    <div className="panel">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={14} className="text-text-ghost" />
        <h3 className="text-sm font-semibold text-text-secondary">{section.title}</h3>
      </div>
      <div className="space-y-3">
        {renderManuscriptContent(section.content)}
      </div>
    </div>
  );
}

/**
 * Lightweight renderer for the composer's plain-text content: blocks separated
 * by blank lines, with `### ` lines becoming subheadings. Avoids pulling in a
 * markdown dependency for the limited formatting the composer actually emits.
 */
function renderManuscriptContent(content: string) {
  const blocks = content.split(/\n{2,}/).filter((block) => block.trim() !== "");

  return blocks.map((block, index) => {
    if (block.startsWith("### ")) {
      const [heading, ...rest] = block.split("\n");
      return (
        <div key={index}>
          <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide mb-1">
            {heading.replace(/^###\s+/, "")}
          </h4>
          {rest.length > 0 && (
            <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line">
              {rest.join("\n")}
            </p>
          )}
        </div>
      );
    }

    return (
      <p key={index} className="text-sm text-text-muted leading-relaxed whitespace-pre-line">
        {block}
      </p>
    );
  });
}
