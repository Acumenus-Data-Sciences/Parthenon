import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, FileText, ExternalLink, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import {
  ManuscriptSectionRenderer,
  AuthorByline,
  ExportMenu,
  type ManuscriptSection,
  type ManuscriptExportFormat,
} from "@/components/manuscript";
import { useStudyManuscript, useExportStudyManuscript, useCreateManuscriptDraft } from "../hooks/useStudies";
import { AskAbbyButton } from "./AskAbbyButton";

interface StudyManuscriptTabProps {
  slug: string;
}

/**
 * Renders the protocol-ordered manuscript composed by the backend
 * ManuscriptComposer (GET /studies/{slug}/manuscript) — the canonical in-study
 * publication view — with docx/pdf export and a gate-aware hand-off to the
 * /publish editorial workspace.
 */
export function StudyManuscriptTab({ slug }: StudyManuscriptTabProps) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { data: manuscript, isLoading, error } = useStudyManuscript(slug);
  const exportMutation = useExportStudyManuscript();
  const createDraft = useCreateManuscriptDraft();
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = (format: ManuscriptExportFormat) => {
    setExportError(null);
    exportMutation.mutate(
      { slug, format },
      { onError: (err) => setExportError(err instanceof Error ? err.message : t("studies.detail.manuscript.exportFailed")) },
    );
  };

  const handleOpenPublisher = () => {
    setExportError(null);
    createDraft.mutate(slug, {
      onSuccess: (draft) => navigate(`/publish/library/${draft.id}`),
      onError: (err) =>
        setExportError(err instanceof Error ? err.message : t("studies.detail.manuscript.openPublisherFailed")),
    });
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
          <AuthorByline authors={manuscript.authors} className="text-sm text-text-muted mt-0.5" />
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
          <AskAbbyButton
            label="Ask Abby"
            variant="ghost"
            className="mr-1"
            prompt="Review this study's composed manuscript: summarize what it reports, whether effect estimates are included or withheld and why, and tell me whether it's ready to open in the Publisher."
          />
          <ExportMenu
            onExport={handleExport}
            isExporting={exportMutation.isPending}
            pendingFormat={exportMutation.variables?.format ?? null}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenPublisher}
            disabled={createDraft.isPending}
            title={t("studies.detail.manuscript.actions.openPublisherTitle")}
            className="flex items-center gap-1"
          >
            {createDraft.isPending ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            {t("studies.detail.manuscript.actions.openPublisher")}
          </Button>
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
      <ManuscriptSectionRenderer content={section.content} />
    </div>
  );
}
