import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "#232328", text: "#8A857D", dot: "#8A857D" },
  protocol_development: { bg: "#60A5FA15", text: "#60A5FA", dot: "#60A5FA" },
  feasibility: { bg: "#A78BFA15", text: "#A78BFA", dot: "#A78BFA" },
  irb_review: { bg: "#F59E0B15", text: "#F59E0B", dot: "#F59E0B" },
  recruitment: { bg: "#2DD4BF15", text: "#2DD4BF", dot: "#2DD4BF" },
  execution: { bg: "#34D39915", text: "#34D399", dot: "#34D399" },
  analysis: { bg: "#60A5FA15", text: "#60A5FA", dot: "#60A5FA" },
  synthesis: { bg: "#A78BFA15", text: "#A78BFA", dot: "#A78BFA" },
  manuscript: { bg: "#FB923C15", text: "#FB923C", dot: "#FB923C" },
  published: { bg: "#2DD4BF15", text: "#2DD4BF", dot: "#2DD4BF" },
  archived: { bg: "#5A565015", text: "#5A5650", dot: "#5A5650" },
  withdrawn: { bg: "#E85A6B15", text: "#E85A6B", dot: "#E85A6B" },
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  protocol_development: "Protocol Development",
  feasibility: "Feasibility",
  irb_review: "IRB Review",
  recruitment: "Recruitment",
  execution: "Execution",
  analysis: "Analysis",
  synthesis: "Synthesis",
  manuscript: "Manuscript",
  published: "Published",
  archived: "Archived",
  withdrawn: "Withdrawn",
};

type TabKey = "overview" | "design" | "analyses" | "results" | "progress" | "sites" | "team" | "cohorts" | "milestones" | "artifacts" | "activity" | "federated";

const TABS: { key: TabKey; label: string; icon: typeof Settings }[] = [
  { key: "overview", label: "Overview", icon: Settings },
  { key: "design", label: "Design", icon: Edit3 },
  { key: "analyses", label: "Analyses", icon: BarChart3 },
  { key: "results", label: "Results", icon: Layers },
  { key: "progress", label: "Progress", icon: Play },
  { key: "sites", label: "Sites", icon: MapPin },
  { key: "team", label: "Team", icon: Users },
  { key: "cohorts", label: "Cohorts", icon: Target },
  { key: "milestones", label: "Milestones", icon: Milestone },
  { key: "artifacts", label: "Artifacts", icon: FileText },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "federated", label: "Federated", icon: Globe2 },
];

export default function StudyDetailPage() {
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
    if (window.confirm("Are you sure you want to delete this study? This action cannot be undone.")) {
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
        title: `Copy of ${study.title}`,
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
    if (window.confirm("Archive this study? It can be restored later.")) {
      transitionMutation.mutate({ slug: study.slug, status: "archived" });
    }
  };

  const statusStyle = STATUS_COLORS[study?.status ?? "draft"] ?? STATUS_COLORS.draft;
  const allowedTransitions = transitions?.allowed_transitions ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-[#E85A6B]">Failed to load study</p>
          <button type="button" onClick={() => navigate("/studies")} className="btn btn-ghost btn-sm mt-4">
            Back to studies
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
          <ArrowLeft size={14} /> Studies
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
                  <h1 className="text-xl font-semibold text-[#F0EDE8] truncate">{study.title}</h1>
                  <button
                    type="button"
                    onClick={() => { setTitleDraft(study.title); setEditingTitle(true); }}
                    className="text-[#5A5650] hover:text-[#C5C0B8] shrink-0"
                  >
                    <Edit3 size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {study.short_title && (
                <span className="px-2 py-0.5 rounded-md bg-[#232328] text-xs text-[#C5C0B8] font-medium">
                  {study.short_title}
                </span>
              )}

              {/* Status badge (clickable for transitions) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTransitions(!showTransitions)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-all hover:ring-1 hover:ring-white/10"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
                  {STATUS_LABELS[study.status] ?? study.status}
                  {allowedTransitions.length > 0 && <ChevronRight size={10} className={cn("transition-transform", showTransitions && "rotate-90")} />}
                </button>

                {showTransitions && allowedTransitions.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-[#232328] bg-[#1C1C20] shadow-xl z-50 py-1">
                    <p className="px-3 py-1.5 text-[10px] text-[#5A5650] uppercase tracking-wider">Transition to</p>
                    {allowedTransitions.map((t) => {
                      const ts = STATUS_COLORS[t] ?? STATUS_COLORS.draft;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleTransition(t)}
                          disabled={transitionMutation.isPending}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#232328] transition-colors"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ts.dot }} />
                          <span style={{ color: ts.text }}>{STATUS_LABELS[t] ?? t}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {study.study_type && (
                <span className="px-2 py-0.5 rounded-md bg-[#2DD4BF]/10 text-xs text-[#2DD4BF]">
                  {study.study_type.replace(/_/g, " ")}
                </span>
              )}

              {study.priority && study.priority !== "medium" && (
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-xs",
                  study.priority === "critical" && "bg-[#E85A6B]/10 text-[#E85A6B]",
                  study.priority === "high" && "bg-[#F59E0B]/10 text-[#F59E0B]",
                  study.priority === "low" && "bg-[#8A857D]/10 text-[#8A857D]",
                )}>
                  {study.priority}
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
                title="Generate manuscript from completed analyses"
              >
                <FileOutput size={14} />
                <span className="text-xs">Manuscript</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={createMutation.isPending}
              className="btn btn-ghost btn-sm"
              title="Duplicate study"
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="btn btn-ghost btn-sm"
              title="Export as JSON"
            >
              <Download size={14} />
            </button>
            {study.status !== "archived" && allowedTransitions.includes("archived") && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={transitionMutation.isPending}
                className="btn btn-ghost btn-sm"
                title="Archive study"
              >
                <Archive size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn btn-danger btn-sm"
              title="Delete study"
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
              {tab.label}
              {count != null && (
                <span className="ml-0.5 text-[10px] font-medium text-[#5A5650]">
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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Main column */}
      <div className="lg:col-span-2 space-y-5">
        {/* Description & Objectives */}
        <div className="panel">
          <h3 className="text-sm font-semibold text-[#C5C0B8] mb-3">About</h3>
          {study.description ? (
            <p className="text-sm text-[#8A857D] leading-relaxed">{study.description}</p>
          ) : (
            <p className="text-sm text-[#5A5650] italic">No description provided</p>
          )}
          {study.primary_objective && (
            <div className="mt-3 pt-3 border-t border-[#232328]">
              <p className="text-xs text-[#5A5650] uppercase tracking-wider mb-1">Primary Objective</p>
              <p className="text-sm text-[#C5C0B8]">{study.primary_objective}</p>
            </div>
          )}
          {study.hypothesis && (
            <div className="mt-3 pt-3 border-t border-[#232328]">
              <p className="text-xs text-[#5A5650] uppercase tracking-wider mb-1">Hypothesis</p>
              <p className="text-sm text-[#C5C0B8]">{study.hypothesis}</p>
            </div>
          )}
          {study.secondary_objectives && study.secondary_objectives.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#232328]">
              <p className="text-xs text-[#5A5650] uppercase tracking-wider mb-1">Secondary Objectives</p>
              <ul className="space-y-1">
                {study.secondary_objectives.map((o, i) => (
                  <li key={i} className="text-sm text-[#8A857D] flex gap-2">
                    <span className="text-[#5A5650]">{i + 1}.</span> {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Analysis Pipeline Summary */}
        {analyses && analyses.length > 0 && (
          <div className="panel">
            <h3 className="text-sm font-semibold text-[#C5C0B8] mb-3">
              Analysis Pipeline ({analyses.length})
            </h3>
            <div className="space-y-2">
              {analyses.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 border border-[#232328] bg-[#151518]"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider",
                      "bg-[#2DD4BF]/10 text-[#2DD4BF]",
                    )}>
                      {entry.analysis_type}
                    </span>
                    <span className="text-sm text-[#C5C0B8]">
                      {entry.analysis?.name ?? `#${entry.analysis_id}`}
                    </span>
                  </div>
                </div>
              ))}
              {analyses.length > 5 && (
                <p className="text-xs text-[#5A5650] text-center">+{analyses.length - 5} more analyses</p>
              )}
            </div>
          </div>
        )}

        {/* Progress Summary */}
        {progress && progress.total > 0 && (
          <div className="panel">
            <h3 className="text-sm font-semibold text-[#C5C0B8] mb-3">Execution Progress</h3>
            <div className="progress-bar mb-2">
              <div className="flex h-full">
                {progress.completed > 0 && (
                  <div style={{ width: `${(progress.completed / progress.total) * 100}%`, background: "#34D399", transition: "width 300ms" }} />
                )}
                {progress.running > 0 && (
                  <div style={{ width: `${(progress.running / progress.total) * 100}%`, background: "#F59E0B", transition: "width 300ms" }} />
                )}
                {progress.failed > 0 && (
                  <div style={{ width: `${(progress.failed / progress.total) * 100}%`, background: "#E85A6B", transition: "width 300ms" }} />
                )}
              </div>
            </div>
            <div className="flex gap-4 text-xs text-[#8A857D]">
              <span>{progress.completed} completed</span>
              <span>{progress.running} running</span>
              <span>{progress.failed} failed</span>
              <span>{progress.pending} pending</span>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-5">
        {/* Metadata */}
        <div className="panel">
          <h3 className="text-sm font-semibold text-[#C5C0B8] mb-3">Details</h3>
          <dl className="space-y-2.5 text-sm">
            {study.principal_investigator && (
              <div className="flex items-start gap-2">
                <User size={14} className="text-[#5A5650] shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-[#5A5650] uppercase tracking-wider">Principal Investigator</dt>
                  <dd className="text-[#C5C0B8]">{study.principal_investigator.name}</dd>
                </div>
              </div>
            )}
            {study.lead_data_scientist && (
              <div className="flex items-start gap-2">
                <User size={14} className="text-[#5A5650] shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-[#5A5650] uppercase tracking-wider">Lead Data Scientist</dt>
                  <dd className="text-[#C5C0B8]">{study.lead_data_scientist.name}</dd>
                </div>
              </div>
            )}
            {study.study_design && (
              <div className="flex items-start gap-2">
                <Settings size={14} className="text-[#5A5650] shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-[#5A5650] uppercase tracking-wider">Study Design</dt>
                  <dd className="text-[#C5C0B8] capitalize">{study.study_design.replace(/_/g, " ")}</dd>
                </div>
              </div>
            )}
            {study.phase && (
              <div className="flex items-start gap-2">
                <Milestone size={14} className="text-[#5A5650] shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-[#5A5650] uppercase tracking-wider">Phase</dt>
                  <dd className="text-[#C5C0B8]">{study.phase}</dd>
                </div>
              </div>
            )}
            {study.protocol_version && (
              <div className="flex items-start gap-2">
                <FileText size={14} className="text-[#5A5650] shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-[#5A5650] uppercase tracking-wider">Protocol Version</dt>
                  <dd className="text-[#C5C0B8]">{study.protocol_version}</dd>
                </div>
              </div>
            )}
            {study.funding_source && (
              <div className="flex items-start gap-2">
                <ExternalLink size={14} className="text-[#5A5650] shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-[#5A5650] uppercase tracking-wider">Funding</dt>
                  <dd className="text-[#C5C0B8]">{study.funding_source}</dd>
                </div>
              </div>
            )}
            {study.clinicaltrials_gov_id && (
              <div className="flex items-start gap-2">
                <ExternalLink size={14} className="text-[#5A5650] shrink-0 mt-0.5" />
                <div>
                  <dt className="text-[10px] text-[#5A5650] uppercase tracking-wider">ClinicalTrials.gov</dt>
                  <dd className="text-[#2DD4BF]">{study.clinicaltrials_gov_id}</dd>
                </div>
              </div>
            )}
          </dl>
        </div>

        {/* Timeline */}
        <div className="panel">
          <h3 className="text-sm font-semibold text-[#C5C0B8] mb-3">Timeline</h3>
          <dl className="space-y-2.5 text-sm">
            {study.study_start_date && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#5A5650]" />
                <dt className="text-[#5A5650]">Start:</dt>
                <dd className="text-[#C5C0B8]">{new Date(study.study_start_date).toLocaleDateString()}</dd>
              </div>
            )}
            {study.study_end_date && (
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-[#5A5650]" />
                <dt className="text-[#5A5650]">End:</dt>
                <dd className="text-[#C5C0B8]">{new Date(study.study_end_date).toLocaleDateString()}</dd>
              </div>
            )}
            {study.target_enrollment_sites != null && (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[#5A5650]" />
                <dt className="text-[#5A5650]">Target Sites:</dt>
                <dd className="text-[#C5C0B8]">{study.actual_enrollment_sites} / {study.target_enrollment_sites}</dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-[#5A5650]" />
              <dt className="text-[#5A5650]">Created:</dt>
              <dd className="text-[#C5C0B8]">{new Date(study.created_at).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        {/* Tags */}
        {study.tags && study.tags.length > 0 && (
          <div className="panel">
            <h3 className="text-sm font-semibold text-[#C5C0B8] mb-2">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {study.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-md bg-[#232328] text-xs text-[#8A857D]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Author */}
        {study.author && (
          <div className="panel">
            <h3 className="text-sm font-semibold text-[#C5C0B8] mb-2">Created By</h3>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center text-xs font-medium text-[#2DD4BF]">
                {study.author.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-[#C5C0B8]">{study.author.name}</p>
                <p className="text-[10px] text-[#5A5650]">{study.author.email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
