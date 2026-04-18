import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Play,
  Settings,
  BarChart3,
  MapPin,
  Users,
  Target,
  Milestone,
  FileText,
  Activity,
  ChevronRight,
  Calendar,
  User,
  ExternalLink,
  Edit3,
  Save,
  X,
  Layers,
  Copy,
  Download,
  Archive,
  FileOutput,
  Globe2,
} from "lucide-react";
import { formatDate } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { StudyDesigner } from "../components/StudyDesigner";
import { StudyDashboard } from "../components/StudyDashboard";
import { StudyAnalysesTab } from "../components/StudyAnalysesTab";
import { StudySitesTab } from "../components/StudySitesTab";
import { StudyTeamTab } from "../components/StudyTeamTab";
import { StudyCohortsTab } from "../components/StudyCohortsTab";
import { StudyMilestonesTab } from "../components/StudyMilestonesTab";
import { StudyArtifactsTab } from "../components/StudyArtifactsTab";
import { StudyActivityTab } from "../components/StudyActivityTab";
import { StudyResultsTab } from "../components/StudyResultsTab";
import { FederatedExecutionTab } from "../components/FederatedExecutionTab";
import {
  useStudy,
  useUpdateStudy,
  useDeleteStudy,
  useCreateStudy,
  useStudyAnalyses,
  useStudyProgress,
  useAllowedTransitions,
  useTransitionStudy,
  useStudySites,
  useStudyTeam,
  useStudyCohorts,
  useStudyMilestones,
  useStudyArtifacts,
} from "../hooks/useStudies";

// ---------------------------------------------------------------------------
// Status & Type styling
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, { bg: string; fg: string; dot: string }> = {
  draft: { bg: "var(--surface-elevated)", fg: "var(--text-muted)", dot: "var(--text-muted)" },
  protocol_development: { bg: "#60A5FA15", fg: "var(--info)", dot: "var(--info)" },
  feasibility: { bg: "#A78BFA15", fg: "var(--domain-observation)", dot: "var(--domain-observation)" },
  irb_review: { bg: "#F59E0B15", fg: "var(--warning)", dot: "var(--warning)" },
  recruitment: { bg: "#2DD4BF15", fg: "var(--success)", dot: "var(--success)" },
  execution: { bg: "#34D39915", fg: "var(--success)", dot: "var(--success)" },
  analysis: { bg: "#60A5FA15", fg: "var(--info)", dot: "var(--info)" },
  synthesis: { bg: "#A78BFA15", fg: "var(--domain-observation)", dot: "var(--domain-observation)" },
  manuscript: { bg: "#FB923C15", fg: "var(--domain-device)", dot: "var(--domain-device)" },
  published: { bg: "#2DD4BF15", fg: "var(--success)", dot: "var(--success)" },
  archived: { bg: "#5A565015", fg: "var(--text-ghost)", dot: "var(--text-ghost)" },
  withdrawn: { bg: "#E85A6B15", fg: "var(--critical)", dot: "var(--critical)" },
};

type TabKey = "overview" | "design" | "analyses" | "results" | "progress" | "sites" | "team" | "cohorts" | "milestones" | "artifacts" | "activity" | "federated";

const TABS: { key: TabKey; icon: typeof Settings }[] = [
  { key: "overview", icon: Settings },
  { key: "design", icon: Edit3 },
  { key: "analyses", icon: BarChart3 },
  { key: "results", icon: Layers },
  { key: "progress", icon: Play },
  { key: "sites", icon: MapPin },
  { key: "team", icon: Users },
  { key: "cohorts", icon: Target },
  { key: "milestones", icon: Milestone },
  { key: "artifacts", icon: FileText },
  { key: "activity", icon: Activity },
  { key: "federated", icon: Globe2 },
];

function humanizeToken(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function StudyDetailPage() {
  const { t } = useTranslation("app");
  const { id: slugOrId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const studyKey = slugOrId ?? null;

  const { data: study, isLoading, error } = useStudy(studyKey);
  const updateMutation = useUpdateStudy();
  const deleteMutation = useDeleteStudy();
  const transitionMutation = useTransitionStudy();

  const slug = study?.slug ?? slugOrId ?? "";
  const { data: analyses } = useStudyAnalyses(slug || null);
  const { data: progress } = useStudyProgress(slug || null);
  const { data: transitions } = useAllowedTransitions(slug || null);
  const createMutation = useCreateStudy();

  // Sub-resource counts for tab badges
  const { data: sitesData } = useStudySites(slug || null);
  const { data: teamData } = useStudyTeam(slug || null);
  const { data: cohortsData } = useStudyCohorts(slug || null);
  const { data: milestonesData } = useStudyMilestones(slug || null);
  const { data: artifactsData } = useStudyArtifacts(slug || null);

  const tabCounts: Partial<Record<TabKey, number>> = {
    analyses: analyses?.length,
    sites: sitesData?.length,
    team: teamData?.length,
    cohorts: cohortsData?.length,
    milestones: milestonesData?.length,
    artifacts: artifactsData?.length,
  };

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showTransitions, setShowTransitions] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const handleDelete = () => {
    if (!study) return;
    if (window.confirm(t("studies.detail.confirmDelete"))) {
      deleteMutation.mutate(study.slug || study.id, {
        onSuccess: () => navigate("/studies"),
      });
    }
  };

  const handleTransition = (status: string) => {
    if (!study) return;
    transitionMutation.mutate(
      { slug: study.slug, status },
      { onSuccess: () => setShowTransitions(false) },
    );
  };

  const handleSaveTitle = () => {
    if (!study || !titleDraft.trim()) return;
    updateMutation.mutate(
      { idOrSlug: study.slug || study.id, payload: { title: titleDraft.trim() } },
      { onSuccess: () => setEditingTitle(false) },
    );
  };

  const handleDuplicate = () => {
    if (!study) return;
    createMutation.mutate(
      {
        title: t("studies.detail.copyTitle", { title: study.title }),
        short_title: study.short_title ? `${study.short_title}-copy` : undefined,
        study_type: study.study_type,
        description: study.description ?? undefined,
        primary_objective: study.primary_objective ?? undefined,
        hypothesis: study.hypothesis ?? undefined,
        study_design: study.study_design ?? undefined,
        priority: study.priority ?? undefined,
        tags: study.tags ?? undefined,
      },
      { onSuccess: (newStudy) => navigate(`/studies/${newStudy.slug || newStudy.id}`) },
    );
  };

  const handleExportJson = () => {
    if (!study) return;
    const blob = new Blob([JSON.stringify(study, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${study.slug || study.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleArchive = () => {
    if (!study) return;
    if (window.confirm(t("studies.detail.confirmArchive"))) {
      transitionMutation.mutate({ slug: study.slug, status: "archived" });
    }
  };

  const statusStyle = STATUS_COLORS[study?.status ?? "draft"] ?? STATUS_COLORS.draft;
  const allowedTransitions = transitions?.allowed_transitions ?? [];
  const statusLabel = (status: string) =>
    t(`studies.detail.statuses.${status}`, { defaultValue: humanizeToken(status) });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-critical">{t("studies.detail.loadFailed")}</p>
          <button type="button" onClick={() => navigate("/studies")} className="btn btn-ghost btn-sm mt-4">
            {t("studies.detail.backToStudies")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-3">
        <button type="button" onClick={() => navigate("/studies")} className="btn btn-ghost btn-sm">
          <ArrowLeft size={14} /> {t("studies.detail.studies")}
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Title (inline editable) */}
            <div className="flex items-center gap-2">
              {editingTitle ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    autoFocus
                    className="form-input text-lg font-semibold flex-1"
                  />
                  <button type="button" onClick={handleSaveTitle} className="btn btn-primary btn-sm"><Save size={14} /></button>
                  <button type="button" onClick={() => setEditingTitle(false)} className="btn btn-ghost btn-sm"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-semibold text-text-primary truncate">{study.title}</h1>
                  <button
                    type="button"
                    onClick={() => { setTitleDraft(study.title); setEditingTitle(true); }}
                    className="text-text-ghost hover:text-text-secondary shrink-0"
                  >
                    <Edit3 size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {study.short_title && (
                <span className="px-2 py-0.5 rounded-md bg-surface-elevated text-xs text-text-secondary font-medium">
                  {study.short_title}
                </span>
              )}

              {/* Status badge (clickable for transitions) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTransitions(!showTransitions)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-all hover:ring-1 hover:ring-white/10"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.fg }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
                  {statusLabel(study.status)}
                  {allowedTransitions.length > 0 && <ChevronRight size={10} className={cn("transition-transform", showTransitions && "rotate-90")} />}
                </button>

                {showTransitions && allowedTransitions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-border-default bg-surface-overlay shadow-xl z-50 py-1">
                    <p className="px-3 py-1.5 text-[10px] text-text-ghost uppercase tracking-wider">
                      {t("studies.detail.actions.transitionTo")}
                    </p>
                    {allowedTransitions.map((t) => {
                      const ts = STATUS_COLORS[t] ?? STATUS_COLORS.draft;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleTransition(t)}
                          disabled={transitionMutation.isPending}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-elevated transition-colors"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ts.dot }} />
                          <span style={{ color: ts.fg }}>{statusLabel(t)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {study.study_type && (
                <span className="px-2 py-0.5 rounded-md bg-success/10 text-xs text-success">
                  {t(`studies.detail.studyTypes.${study.study_type}`, { defaultValue: humanizeToken(study.study_type) })}
                </span>
              )}

              {study.priority && study.priority !== "medium" && (
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-xs",
                  study.priority === "critical" && "bg-critical/10 text-critical",
                  study.priority === "high" && "bg-warning/10 text-warning",
                  study.priority === "low" && "bg-text-muted/10 text-text-muted",
                )}>
                  {t(`studies.priorities.${study.priority}`, { defaultValue: humanizeToken(study.priority) })}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(analyses ?? []).some(
              (sa) => sa.analysis?.latest_execution?.status === "completed"
            ) && (
              <button
                type="button"
                onClick={() => navigate(`/publish?studyId=${study.id}`)}
                className="btn btn-ghost btn-sm flex items-center gap-1"
                title={t("studies.detail.actions.generateManuscriptTitle")}
              >
                <FileOutput size={14} />
                <span className="text-xs">{t("studies.detail.actions.manuscript")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={createMutation.isPending}
              className="btn btn-ghost btn-sm"
              title={t("studies.detail.actions.duplicateStudy")}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="btn btn-ghost btn-sm"
              title={t("studies.detail.actions.exportJson")}
            >
              <Download size={14} />
            </button>
            {study.status !== "archived" && allowedTransitions.includes("archived") && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={transitionMutation.isPending}
                className="btn btn-ghost btn-sm"
                title={t("studies.detail.actions.archiveStudy")}
              >
                <Archive size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn btn-danger btn-sm"
              title={t("studies.detail.actions.deleteStudy")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tab-bar overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn("tab-item flex items-center gap-1.5 whitespace-nowrap", activeTab === tab.key && "active")}
            >
              <Icon size={14} />
              {t(`studies.detail.tabs.${tab.key}`)}
              {count != null && (
                <span className="ml-0.5 text-[10px] font-medium text-text-ghost">
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <StudyOverview study={study} analyses={analyses} progress={progress} />
      )}
      {activeTab === "design" && <StudyDesigner study={study} />}
      {activeTab === "analyses" && <StudyAnalysesTab studyId={study.id} studySlug={study.slug} />}
      {activeTab === "results" && <StudyResultsTab slug={study.slug} />}
      {activeTab === "progress" && <StudyDashboard analyses={analyses} progress={progress} />}
      {activeTab === "sites" && <StudySitesTab slug={study.slug} />}
      {activeTab === "team" && <StudyTeamTab slug={study.slug} />}
      {activeTab === "cohorts" && <StudyCohortsTab slug={study.slug} />}
      {activeTab === "milestones" && <StudyMilestonesTab slug={study.slug} />}
      {activeTab === "artifacts" && <StudyArtifactsTab slug={study.slug} />}
      {activeTab === "activity" && <StudyActivityTab slug={study.slug} />}
      {activeTab === "federated" && <FederatedExecutionTab studySlug={study.slug} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview sub-component (inlined)
// ---------------------------------------------------------------------------

import type { Study, StudyAnalysisEntry, StudyProgress as StudyProgressType } from "../types/study";

function StudyOverview({
  study,
  analyses,
  progress,
}: {
  study: Study;
  analyses?: StudyAnalysisEntry[];
  progress?: StudyProgressType | null;
}) {
  const { t } = useTranslation("app");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-5">
        {/* Description & Objectives */}
        <div className="panel">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">
            {t("studies.detail.sections.about")}
          </h3>
          {study.description ? (
            <p className="text-sm text-text-muted leading-relaxed">{study.description}</p>
          ) : (
            <p className="text-sm text-text-ghost italic">
              {t("studies.detail.messages.noDescription")}
            </p>
          )}
          {study.primary_objective && (
            <div className="mt-3 pt-3 border-t border-border-default">
              <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">
                {t("studies.detail.labels.primaryObjective")}
              </p>
              <p className="text-sm text-text-secondary">{study.primary_objective}</p>
            </div>
          )}
          {study.hypothesis && (
            <div className="mt-3 pt-3 border-t border-border-default">
              <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">
                {t("studies.detail.labels.hypothesis")}
              </p>
              <p className="text-sm text-text-secondary">{study.hypothesis}</p>
            </div>
          )}
          {study.secondary_objectives && study.secondary_objectives.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-default">
              <p className="text-xs text-text-ghost uppercase tracking-wider mb-1">
                {t("studies.detail.labels.secondaryObjectives")}
              </p>
              <ul className="space-y-1">
                {study.secondary_objectives.map((o, i) => (
                  <li key={i} className="text-sm text-text-muted flex gap-2">
                    <span className="text-text-ghost">{i + 1}.</span> {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Analysis Pipeline Summary */}
        {analyses && analyses.length > 0 && (
          <div className="panel">
            <h3 className="text-sm font-semibold text-text-secondary mb-3">
              {t("studies.detail.sections.analysisPipeline", { count: analyses.length })}
            </h3>
            <div className="space-y-2">
              {analyses.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 border border-border-default bg-surface-raised"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider",
                      "bg-success/10 text-success",
                    )}>
                      {entry.analysis_type}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {entry.analysis?.name ?? `#${entry.analysis_id}`}
                    </span>
                  </div>
                </div>
              ))}
              {analyses.length > 5 && (
                <p className="text-xs text-text-ghost text-center">
                  {t("studies.detail.messages.moreAnalyses", { count: analyses.length - 5 })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Progress Summary */}
        {progress && progress.total > 0 && (
          <div className="panel">
            <h3 className="text-sm font-semibold text-text-secondary mb-3">
              {t("studies.detail.sections.executionProgress")}
            </h3>
            <div className="progress-bar mb-2">
              <div className="flex h-full">
                {progress.completed > 0 && (
                  <div style={{ width: `${(progress.completed / progress.total) * 100}%`, background: "var(--success)", transition: "width 300ms" }} />
                )}
                {progress.running > 0 && (
                  <div style={{ width: `${(progress.running / progress.total) * 100}%`, background: "var(--warning)", transition: "width 300ms" }} />
                )}
                {progress.failed > 0 && (
                  <div style={{ width: `${(progress.failed / progress.total) * 100}%`, background: "var(--critical)", transition: "width 300ms" }} />
                )}
              </div>
            </div>
            <div className="flex gap-4 text-xs text-text-muted">
              <span>{t("studies.detail.progress.completed", { count: progress.completed })}</span>
              <span>{t("studies.detail.progress.running", { count: progress.running })}</span>
              <span>{t("studies.detail.progress.failed", { count: progress.failed })}</span>
              <span>{t("studies.detail.progress.pending", { count: progress.pending })}</span>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-5">
        {/* Metadata */}
        <div className="panel">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">
            {t("studies.detail.sections.details")}
          </h3>
          <dl className="space-y-2.5 text-sm">
            {study.principal_investigator && (
              <div className="flex items-start gap-2">
                <User size={14} className="text-text-ghost shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-text-ghost uppercase tracking-wider">
                    {t("studies.detail.labels.principalInvestigator")}
                  </dt>
                  <dd className="text-text-secondary">{study.principal_investigator.name}</dd>
                </div>
              </div>
            )}
            {study.lead_data_scientist && (
              <div className="flex items-start gap-2">
                <User size={14} className="text-text-ghost shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-text-ghost uppercase tracking-wider">
                    {t("studies.detail.labels.leadDataScientist")}
                  </dt>
                  <dd className="text-text-secondary">{study.lead_data_scientist.name}</dd>
                </div>
              </div>
            )}
            {study.study_design && (
              <div className="flex items-start gap-2">
                <Settings size={14} className="text-text-ghost shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-text-ghost uppercase tracking-wider">
                    {t("studies.detail.labels.studyDesign")}
                  </dt>
                  <dd className="text-text-secondary capitalize">{humanizeToken(study.study_design)}</dd>
                </div>
              </div>
            )}
            {study.phase && (
              <div className="flex items-start gap-2">
                <Milestone size={14} className="text-text-ghost shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-text-ghost uppercase tracking-wider">
                    {t("studies.detail.labels.phase")}
                  </dt>
                  <dd className="text-text-secondary">{study.phase}</dd>
                </div>
              </div>
            )}
            {study.protocol_version && (
              <div className="flex items-start gap-2">
                <FileText size={14} className="text-text-ghost shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-text-ghost uppercase tracking-wider">
                    {t("studies.detail.labels.protocolVersion")}
                  </dt>
                  <dd className="text-text-secondary">{study.protocol_version}</dd>
                </div>
              </div>
            )}
            {study.funding_source && (
              <div className="flex items-start gap-2">
                <ExternalLink size={14} className="text-text-ghost shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-text-ghost uppercase tracking-wider">
                    {t("studies.detail.labels.funding")}
                  </dt>
                  <dd className="text-text-secondary">{study.funding_source}</dd>
                </div>
              </div>
            )}
            {study.clinicaltrials_gov_id && (
              <div className="flex items-start gap-2">
                <ExternalLink size={14} className="text-text-ghost shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-text-ghost uppercase tracking-wider">
                    {t("studies.detail.labels.clinicalTrialsGov")}
                  </dt>
                  <dd className="text-success">{study.clinicaltrials_gov_id}</dd>
                </div>
              </div>
            )}
          </dl>
        </div>

        {/* Timeline */}
        <div className="panel">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">
            {t("studies.detail.sections.timeline")}
          </h3>
          <dl className="space-y-2.5 text-sm">
            {study.study_start_date && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-text-ghost" />
                <dt className="text-text-ghost">{t("studies.detail.labels.start")}</dt>
                <dd className="text-text-secondary">{formatDate(study.study_start_date)}</dd>
              </div>
            )}
            {study.study_end_date && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-text-ghost" />
                <dt className="text-text-ghost">{t("studies.detail.labels.end")}</dt>
                <dd className="text-text-secondary">{formatDate(study.study_end_date)}</dd>
              </div>
            )}
            {study.target_enrollment_sites != null && (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-text-ghost" />
                <dt className="text-text-ghost">{t("studies.detail.labels.targetSites")}</dt>
                <dd className="text-text-secondary">{study.actual_enrollment_sites} / {study.target_enrollment_sites}</dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-text-ghost" />
              <dt className="text-text-ghost">{t("studies.detail.labels.created")}</dt>
              <dd className="text-text-secondary">{formatDate(study.created_at)}</dd>
            </div>
          </dl>
        </div>

        {/* Tags */}
        {study.tags && study.tags.length > 0 && (
          <div className="panel">
            <h3 className="text-sm font-semibold text-text-secondary mb-2">
              {t("studies.detail.sections.tags")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {study.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-surface-elevated text-xs text-text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Author */}
        {study.author && (
          <div className="panel">
            <h3 className="text-sm font-semibold text-text-secondary mb-2">
              {t("studies.detail.sections.createdBy")}
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-success/10 flex items-center justify-center text-xs font-medium text-success">
                {study.author.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-text-secondary">{study.author.name}</p>
                <p className="text-[10px] text-text-ghost">{study.author.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
