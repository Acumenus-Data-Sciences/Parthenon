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
import { CohortOverlapPanel } from "../components/CohortOverlapPanel";
import {
  useCohortDefinition,
  useUpdateCohortDefinition,
  useDeleteCohortDefinition,
  useCopyCohortDefinition,
} from "../hooks/useCohortDefinitions";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";

type Tab = "editor" | "results" | "diagnostics" | "overlap";

export default function CohortDefinitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cohortId = id ? Number(id) : null;

  const { data: definition, isLoading, error } = useCohortDefinition(cohortId);
  const updateMutation = useUpdateCohortDefinition();
  const deleteMutation = useDeleteCohortDefinition();
  const copyMutation = useCopyCohortDefinition();

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

  // Ctrl+S / Cmd+S keyboard shortcut
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
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error || !definition) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-[#E85A6B]">Failed to load cohort definition</p>
          <button
            type="button"
            onClick={() => navigate("/cohort-definitions")}
            className="mt-4 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate("/cohort-definitions")}
            className="inline-flex items-center gap-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors mb-3"
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
                  "text-2xl font-bold bg-transparent border-b-2 border-[#2DD4BF] text-[#F0EDE8]",
                  "focus:outline-none px-0 py-0",
                )}
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={updateMutation.isPending}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#2DD4BF] hover:bg-[#2DD4BF]/10 transition-colors"
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
              className="text-2xl font-bold text-[#F0EDE8] cursor-pointer hover:text-[#2DD4BF] transition-colors"
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
                  "flex-1 text-sm bg-transparent border-b border-[#2DD4BF] text-[#C5C0B8]",
                  "placeholder:text-[#5A5650] focus:outline-none px-0 py-0",
                )}
              />
              <button
                type="button"
                onClick={handleSaveDescription}
                disabled={updateMutation.isPending}
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#2DD4BF] hover:bg-[#2DD4BF]/10 transition-colors"
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
                  ? "text-[#8A857D] hover:text-[#C5C0B8]"
                  : "text-[#5A5650] hover:text-[#8A857D]",
              )}
              title="Click to edit"
            >
              {definition.description ?? "Add a description..."}
            </p>
          )}

          {/* Version badge + last saved */}
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
              v{definition.version}
            </span>
            <span className="text-[10px] text-[#5A5650]">
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
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] bg-[#1A1A1F] text-[#8A857D] border border-[#2A2A30] group"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5A5650] hover:text-[#E85A6B]"
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
                className="rounded px-2 py-0.5 text-[10px] w-20 bg-[#0E0E11] border border-[#2DD4BF] text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingTag(true)}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-[#5A5650] hover:text-[#8A857D] border border-dashed border-[#323238] hover:border-[#5A5650] transition-colors"
              >
                <Plus size={8} />
                tag
              </button>
            )}
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
                ? "bg-[#2DD4BF] text-[#0E0E11] hover:bg-[#26B8A5]"
                : "border border-[#232328] bg-[#151518] text-[#5A5650] cursor-not-allowed",
            )}
          >
            {updateMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save
            {isDirty && (
              <span className="inline-flex w-2 h-2 rounded-full bg-[#0E0E11]/40" />
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
                ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                : "border-[#232328] bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8]",
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
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-gradient-to-r from-[#2DD4BF]/20 to-[#A78BFA]/20 border border-[#2DD4BF]/30 text-[#2DD4BF] hover:from-[#2DD4BF]/30 hover:to-[#A78BFA]/30 transition-all"
          >
            <Sparkles size={14} />
            Abby AI
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
          >
            <Download size={14} />
            Export
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
          >
            <Share2 size={14} />
            Share
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={copyMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#C5C0B8] transition-colors disabled:opacity-50"
          >
            {copyMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Copy size={14} />
            )}
            Copy
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#E85A6B] hover:border-[#E85A6B]/30 transition-colors disabled:opacity-50"
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
      <div className="flex items-center gap-1 border-b border-[#232328]">
        {(
          [
            { key: "editor", label: "Expression Editor" },
            { key: "results", label: "SQL & Generation" },
            { key: "diagnostics", label: "Diagnostics" },
            { key: "overlap", label: "Overlap" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "text-[#2DD4BF]"
                : "text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2DD4BF]" />
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
          <div>
            <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">
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
          <CohortGenerationPanel definitionId={cohortId} />
          <GenerationHistoryTable definitionId={cohortId} />
        </div>
      ) : (
        <CohortOverlapPanel currentCohortId={cohortId} />
      )}

      {/* Abby AI Panel */}
      <AbbyAiPanel
        isOpen={abbyOpen}
        onClose={() => setAbbyOpen(false)}
        onApply={(expr) => {
          loadExpression(expr);
          setAbbyOpen(false);
        }}
      />

      {/* Share Modal */}
      {shareOpen && cohortId && (
        <ShareCohortModal
          cohortId={cohortId}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
