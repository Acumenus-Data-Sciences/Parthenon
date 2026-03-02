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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CohortExpressionEditor } from "../components/CohortExpressionEditor";
import { CohortSqlPreview } from "../components/CohortSqlPreview";
import { CohortGenerationPanel } from "../components/CohortGenerationPanel";
import { GenerationHistoryTable } from "../components/GenerationHistoryTable";
import {
  useCohortDefinition,
  useUpdateCohortDefinition,
  useDeleteCohortDefinition,
  useCopyCohortDefinition,
} from "../hooks/useCohortDefinitions";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";

type Tab = "editor" | "results";

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

          {/* Version badge */}
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]">
              v{definition.version}
            </span>
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
      ) : (
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
      )}
    </div>
  );
}
