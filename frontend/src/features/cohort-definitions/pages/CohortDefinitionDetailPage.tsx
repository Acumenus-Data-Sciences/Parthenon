import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Save,
  Copy,
  Globe,
  Lock,
  Sparkles,
  Download,
  Share2,
  Plus,
  X,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { AbbyAiPanel } from "@/features/abby-ai/components/AbbyAiPanel";
import { ShareCohortModal } from "../components/ShareCohortModal";
import { cn } from "@/lib/utils";
import { exportCohortDefinition } from "../api/cohortApi";
import { CohortExpressionEditor } from "../components/CohortExpressionEditor";
import { CohortSqlPreview } from "../components/CohortSqlPreview";
import { CohortGenerationPanel } from "../components/CohortGenerationPanel";
import { GenerationHistoryTable } from "../components/GenerationHistoryTable";
import { AttritionChart } from "../components/AttritionChart";
import { CohortDiagnosticsPanel } from "../components/CohortDiagnosticsPanel";
import { CohortOverlapPanel } from "../components/CohortOverlapPanel";
import { CohortPatientListPanel } from "../components/CohortPatientListPanel";
import { CirceSqlPanel } from "../components/CirceSqlPanel";
import {
  useCohortDefinition,
  useUpdateCohortDefinition,
  useDeleteCohortDefinition,
  useCopyCohortDefinition,
  useDeprecateCohort,
  useRestoreActiveCohort,
} from "../hooks/useCohortDefinitions";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import type { CohortExpression, CohortDomain } from "../types/cohortExpression";

const DOMAIN_OPTIONS: Array<{ value: CohortDomain; label: string }> = [
  { value: "cardiovascular", label: "Cardiovascular" },
  { value: "metabolic", label: "Metabolic / Endocrine" },
  { value: "renal", label: "Renal" },
  { value: "oncology", label: "Oncology" },
  { value: "rare-disease", label: "Rare Disease" },
  { value: "pain-substance-use", label: "Pain & Substance Use" },
  { value: "pediatric", label: "Pediatric" },
  { value: "general", label: "General" },
];

type Tab = "editor" | "results" | "diagnostics" | "overlap" | "patients";

export default function CohortDefinitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cohortId = id ? Number(id) : null;

  const { data: definition, isLoading, error } = useCohortDefinition(cohortId);
  const updateMutation = useUpdateCohortDefinition();
  const deleteMutation = useDeleteCohortDefinition();
  const copyMutation = useCopyCohortDefinition();

  const deprecateMutation = useDeprecateCohort();
  const restoreMutation = useRestoreActiveCohort();

  const { expression, isDirty, loadExpression, reset } =
    useCohortExpressionStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("editor");
  const [abbyOpen, setAbbyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Load expression from API into store
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (definition) {
      setName(definition.name);
      setDescription(definition.description ?? "");
      loadExpression(definition.expression_json);
    }
    return () => {
      reset();
    };
  }, [definition]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Ctrl+S / Cmd+S keyboard shortcut
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && cohortId) {
          updateMutation.mutate(
            { id: cohortId, payload: { expression_json: expression } },
            { onSuccess: () => loadExpression(expression) },
          );
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isDirty, cohortId, expression]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleSaveName = () => {
    if (!cohortId || !name.trim()) return;
    updateMutation.mutate(
      { id: cohortId, payload: { name: name.trim() } },
      { onSuccess: () => setIsEditingName(false) },
    );
  };

  const handleSaveDescription = () => {
    if (!cohortId) return;
    updateMutation.mutate(
      {
        id: cohortId,
        payload: { description: description.trim() || undefined },
      },
      { onSuccess: () => setIsEditingDesc(false) },
    );
  };

  const handleSaveExpression = () => {
    if (!cohortId) return;
    updateMutation.mutate(
      { id: cohortId, payload: { expression_json: expression } },
      {
        onSuccess: () => {
          // Reload to mark as not dirty
          loadExpression(expression);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!cohortId) return;
    if (
      window.confirm(
        "Are you sure you want to delete this cohort definition?",
      )
    ) {
      deleteMutation.mutate(cohortId, {
        onSuccess: () => navigate("/cohort-definitions"),
      });
    }
  };

  const handleCopy = () => {
    if (!cohortId) return;
    copyMutation.mutate(cohortId, {
      onSuccess: (copied) => navigate(`/cohort-definitions/${copied.id}`),
    });
  };

  const handleTogglePublic = () => {
    if (!definition || !cohortId) return;
    updateMutation.mutate({
      id: cohortId,
      payload: { is_public: !definition.is_public },
    });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || !cohortId || !definition) return;
    const currentTags = definition.tags ?? [];
    if (currentTags.includes(tag)) {
      setTagInput("");
      setIsAddingTag(false);
      return;
    }
    updateMutation.mutate(
      { id: cohortId, payload: { tags: [...currentTags, tag] } },
      {
        onSuccess: () => {
          setTagInput("");
          setIsAddingTag(false);
        },
      },
    );
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!cohortId || !definition) return;
    const currentTags = definition.tags ?? [];
    updateMutation.mutate({
      id: cohortId,
      payload: { tags: currentTags.filter((t) => t !== tagToRemove) },
    });
  };

  const handleDomainChange = (newDomain: string) => {
    if (!cohortId) return;
    updateMutation.mutate({
      id: cohortId,
      payload: { domain: (newDomain || null) as CohortDomain | null },
    });
  };

  const handleDeprecate = () => {
    if (!cohortId) return;
    if (
      window.confirm(
        "Deprecate this cohort? It will remain visible but cannot be added to new studies.",
      )
    ) {
      deprecateMutation.mutate({ id: cohortId });
    }
  };

  const handleRestoreActive = () => {
    if (!cohortId) return;
    restoreMutation.mutate(cohortId);
  };

  const handleExport = async () => {
    if (!cohortId) return;
    const exported = await exportCohortDefinition(cohortId);
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${definition?.name ?? "cohort"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !definition) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-critical">Failed to load cohort definition</p>
          <button
            type="button"
            onClick={() => navigate("/cohort-definitions")}
            className="mt-4 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deprecation banner */}
      {definition.deprecated_at && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-400">
              Deprecated on{" "}
              {new Date(definition.deprecated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {definition.superseded_by_cohort && (
              <p className="text-xs text-amber-400/70 mt-0.5">
                Superseded by{" "}
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/cohort-definitions/${definition.superseded_by_cohort!.id}`,
                    )
                  }
                  className="underline hover:text-amber-300 transition-colors"
                >
                  {definition.superseded_by_cohort.name}
                </button>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRestoreActive}
            disabled={restoreMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            {restoreMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RotateCcw size={12} />
            )}
            Restore
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate("/cohort-definitions")}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Cohort Definitions
          </button>

          {/* Editable Name */}
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setName(definition.name);
                    setIsEditingName(false);
                  }
                }}
                autoFocus
                className={cn(
                  "text-2xl font-bold bg-transparent border-b-2 border-success text-text-primary",
                  "focus:outline-none px-0 py-0",
                )}
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={updateMutation.isPending}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-success hover:bg-success/10 transition-colors"
              >
                {updateMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
              </button>
            </div>
          ) : (
            <h1
              onClick={() => setIsEditingName(true)}
              className="text-2xl font-bold text-text-primary cursor-pointer hover:text-success transition-colors"
              title="Click to edit"
            >
              {definition.name}
            </h1>
          )}

          {/* Editable Description */}
          {isEditingDesc ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDescription();
                  if (e.key === "Escape") {
                    setDescription(definition.description ?? "");
                    setIsEditingDesc(false);
                  }
                }}
                autoFocus
                placeholder="Add a description..."
                className={cn(
                  "flex-1 text-sm bg-transparent border-b border-success text-text-secondary",
                  "placeholder:text-text-ghost focus:outline-none px-0 py-0",
                )}
              />
              <button
                type="button"
                onClick={handleSaveDescription}
                disabled={updateMutation.isPending}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-success hover:bg-success/10 transition-colors"
              >
                {updateMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
              </button>
            </div>
          ) : (
            <p
              onClick={() => setIsEditingDesc(true)}
              className={cn(
                "mt-1 text-sm cursor-pointer transition-colors",
                definition.description
                  ? "text-text-muted hover:text-text-secondary"
                  : "text-text-ghost hover:text-text-muted",
              )}
              title="Click to edit"
            >
              {definition.description ?? "Add a description..."}
            </p>
          )}

          {/* Version badge + last saved */}
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent">
              v{definition.version}
            </span>
            <span className="text-[10px] text-text-ghost">
              Last saved{" "}
              {new Date(definition.updated_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {definition.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] bg-surface-overlay text-text-muted border border-border-default group"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-text-ghost hover:text-critical"
                >
                  <X size={8} />
                </button>
              </span>
            ))}
            {isAddingTag ? (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") {
                    setTagInput("");
                    setIsAddingTag(false);
                  }
                }}
                onBlur={() => {
                  if (!tagInput.trim()) setIsAddingTag(false);
                }}
                autoFocus
                placeholder="tag name"
                className="rounded px-2 py-0.5 text-[10px] w-20 bg-surface-base border border-success text-text-primary placeholder:text-text-ghost focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingTag(true)}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-text-ghost hover:text-text-muted border border-dashed border-surface-highlight hover:border-text-ghost transition-colors"
              >
                <Plus size={8} />
                tag
              </button>
            )}
          </div>

          {/* Domain */}
          <div className="flex items-center gap-2 mt-2">
            <select
              value={definition.domain ?? ""}
              onChange={(e) => handleDomainChange(e.target.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs border transition-colors",
                "bg-surface-overlay border-border-default text-text-secondary",
                "hover:border-surface-highlight focus:border-success focus:outline-none",
                !definition.domain && "text-text-ghost",
              )}
            >
              <option value="">Assign a domain</option>
              {DOMAIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Save expression */}
          <button
            type="button"
            onClick={handleSaveExpression}
            disabled={!isDirty || updateMutation.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isDirty
                ? "bg-success text-surface-base hover:bg-success"
                : "border border-border-default bg-surface-raised text-text-ghost cursor-not-allowed",
            )}
          >
            {updateMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save
            {isDirty && (
              <span className="inline-flex w-2 h-2 rounded-full bg-surface-base/40" />
            )}
          </button>

          {/* Toggle public */}
          <button
            type="button"
            onClick={handleTogglePublic}
            disabled={updateMutation.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
              definition.is_public
                ? "border-success/30 bg-success/10 text-success"
                : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary",
            )}
          >
            {definition.is_public ? (
              <Globe size={14} />
            ) : (
              <Lock size={14} />
            )}
            {definition.is_public ? "Public" : "Private"}
          </button>

          {/* Abby AI */}
          <button
            type="button"
            onClick={() => setAbbyOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-gradient-to-r from-success/20 to-[var(--domain-observation)]/20 border border-success/30 text-success hover:from-success/30 hover:to-[var(--domain-observation)]/30 transition-all"
          >
            <Sparkles size={14} />
            Abby AI
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            <Download size={14} />
            Export
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            <Share2 size={14} />
            Share
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={copyMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
          >
            {copyMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Copy size={14} />
            )}
            Copy
          </button>

          {/* Deprecate */}
          {!definition.deprecated_at && (
            <button
              type="button"
              onClick={handleDeprecate}
              disabled={deprecateMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-amber-400 hover:border-amber-500/30 transition-colors disabled:opacity-50"
            >
              {deprecateMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <AlertTriangle size={14} />
              )}
              Deprecate
            </button>
          )}

          {/* Delete */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-critical hover:border-critical/30 transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border-default">
        {(
          [
            { key: "editor", label: "Expression Editor" },
            { key: "results", label: "SQL & Generation" },
            { key: "diagnostics", label: "Diagnostics" },
            { key: "overlap", label: "Overlap" },
            { key: "patients", label: "Patient List" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-success"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "editor" ? (
        <CohortExpressionEditor />
      ) : activeTab === "results" ? (
        <div className="space-y-6">
          <CohortGenerationPanel definitionId={cohortId} />
          <CohortSqlPreview definitionId={cohortId} />
          <CirceSqlPanel definitionId={cohortId} />
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">
              Generation History
            </h3>
            <GenerationHistoryTable definitionId={cohortId} />
          </div>
        </div>
      ) : activeTab === "diagnostics" ? (
        <div className="space-y-6">
          {/* Attrition Chart — uses inclusion rule stats from latest generation */}
          <AttritionChart
            steps={definition.latest_generation?.inclusion_rule_stats ?? null}
            totalCount={definition.latest_generation?.person_count ?? null}
          />
          {cohortId && <CohortDiagnosticsPanel definitionId={cohortId} />}
          <CohortGenerationPanel definitionId={cohortId} />
          <GenerationHistoryTable definitionId={cohortId} />
        </div>
      ) : activeTab === "overlap" ? (
        <CohortOverlapPanel
          currentCohortId={cohortId}
          generationSources={definition.generation_sources}
        />
      ) : (
        <CohortPatientListPanel
          definitionId={cohortId}
          generationSources={definition.generation_sources}
        />
      )}

      {/* Abby AI Panel */}
      <AbbyAiPanel
        isOpen={abbyOpen}
        onClose={() => setAbbyOpen(false)}
        onApply={(expr) => {
          loadExpression(expr as unknown as CohortExpression);
          setAbbyOpen(false);
        }}
      />

      {/* Share Modal */}
      {cohortId && (
        <ShareCohortModal
          cohortId={cohortId}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
