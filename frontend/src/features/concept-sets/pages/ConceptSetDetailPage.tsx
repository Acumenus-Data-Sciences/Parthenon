import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Save,
  Globe,
  Lock,
  Download,
  Copy,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toast";
import { useTranslation } from "react-i18next";
import { ConceptSetEditor } from "../components/ConceptSetEditor";
import { PhoebeRecommendationsPanel } from "../components/PhoebeRecommendationsPanel";
import { ConceptSetBuilderLayout } from "../components/ConceptSetBuilderLayout";
import { VocabularySearchPanel } from "@/features/vocabulary/components/VocabularySearchPanel";
import { SemanticSearchPanel } from "@/features/vocabulary/components/SemanticSearchPanel";
import {
  useConceptSet,
  useUpdateConceptSet,
  useDeleteConceptSet,
  useCopyConceptSet,
  useAddConceptSetItem,
} from "../hooks/useConceptSets";
import { useAggregatedPhoebeRecommendations } from "../hooks/usePhoebeRecommendations";
import { exportConceptSet } from "../api/conceptSetApi";

export default function ConceptSetDetailPage() {
  const { t } = useTranslation("app");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conceptSetId = id ? Number(id) : null;

  const { data: conceptSet, isLoading, error } = useConceptSet(conceptSetId);
  const updateMutation = useUpdateConceptSet();
  const deleteMutation = useDeleteConceptSet();
  const copyMutation = useCopyConceptSet();
  const addPhoebeItem = useAddConceptSetItem();

  const conceptIds = useMemo(
    () => (conceptSet?.items ?? []).map((i) => i.concept_id),
    [conceptSet],
  );

  const {
    data: aggregatedData,
    isLoading: isAggregatedLoading,
    isError: isAggregatedError,
  } = useAggregatedPhoebeRecommendations(conceptIds);

  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [searchTab, setSearchTab] = useState<"keyword" | "semantic">("keyword");

  const initialQuery = searchParams.get("q") ?? undefined;
  const initialFilters = useMemo(() => ({
    domain: searchParams.get("domain") ?? undefined,
    vocabulary: searchParams.get("vocabulary") ?? undefined,
    standard: searchParams.get("standard") === "true" ? true : undefined,
  }), [searchParams]);

  const conceptSetItemIds = useMemo(
    () => new Set(conceptSet?.items?.map((item) => item.concept_id) ?? []),
    [conceptSet?.items],
  );

  const handleSaveName = () => {
    if (!conceptSetId || !nameDraft.trim()) return;
    updateMutation.mutate(
      { id: conceptSetId, payload: { name: nameDraft.trim() } },
      { onSuccess: () => setIsEditingName(false) },
    );
  };

  const handleSaveDescription = () => {
    if (!conceptSetId) return;
    updateMutation.mutate(
      {
        id: conceptSetId,
        payload: { description: descriptionDraft.trim() || undefined },
      },
      { onSuccess: () => setIsEditingDesc(false) },
    );
  };

  const handleDelete = () => {
    if (!conceptSetId) return;
    if (window.confirm(t("conceptSets.detail.deleteConfirm"))) {
      deleteMutation.mutate(conceptSetId, {
        onSuccess: () => navigate("/concept-sets"),
      });
    }
  };

  const handleTogglePublic = () => {
    if (!conceptSet || !conceptSetId) return;
    updateMutation.mutate({
      id: conceptSetId,
      payload: { is_public: !conceptSet.is_public },
    });
  };

  const handleDuplicate = () => {
    if (!conceptSetId) return;
    copyMutation.mutate(conceptSetId, {
      onSuccess: (copy) => {
        toast.success(
          t("conceptSets.detail.duplicateSuccess", { name: copy.name }),
        );
        navigate(`/concept-sets/${copy.id}`);
      },
      onError: () => {
        toast.error(t("conceptSets.detail.duplicateFailed"));
      },
    });
  };

  const handleExport = async () => {
    if (!conceptSetId) return;
    const exported = await exportConceptSet(conceptSetId);
    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conceptSet?.name ?? t("conceptSets.detail.exportFallbackName")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddToSet = (conceptId: number) => {
    if (!conceptSetId) return;
    addPhoebeItem.mutate({
      setId: conceptSetId,
      payload: {
        concept_id: conceptId,
        include_descendants: true,
        include_mapped: false,
        is_excluded: false,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !conceptSet) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-critical">{t("conceptSets.detail.failedToLoad")}</p>
          <button
            type="button"
            onClick={() => navigate("/concept-sets")}
            className="mt-4 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            {t("conceptSets.detail.backToList")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Back link */}
          <button
            type="button"
            onClick={() => navigate("/concept-sets")}
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            {t("conceptSets.page.title")}
          </button>

          {/* Editable Name */}
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
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
              onClick={() => {
                setNameDraft(conceptSet.name);
                setIsEditingName(true);
              }}
              className="text-2xl font-bold text-text-primary cursor-pointer hover:text-success transition-colors"
              title={t("conceptSets.detail.clickToEdit")}
            >
              {conceptSet.name}
            </h1>
          )}

          {/* Editable Description */}
          {isEditingDesc ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={descriptionDraft}
                onChange={(e) => setDescriptionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveDescription();
                  if (e.key === "Escape") {
                    setIsEditingDesc(false);
                  }
                }}
                autoFocus
                placeholder={t("conceptSets.detail.addDescription")}
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
              onClick={() => {
                setDescriptionDraft(conceptSet.description ?? "");
                setIsEditingDesc(true);
              }}
              className={cn(
                "mt-1 text-sm cursor-pointer transition-colors",
                conceptSet.description
                  ? "text-text-muted hover:text-text-secondary"
                  : "text-text-ghost hover:text-text-muted",
              )}
              title={t("conceptSets.detail.clickToEdit")}
            >
              {conceptSet.description ?? t("conceptSets.detail.addDescription")}
            </p>
          )}

          {/* Tags */}
          {conceptSet.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {conceptSet.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-accent/15 text-accent"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={copyMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
          >
            {copyMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Copy size={14} />
            )}
            {t("conceptSets.detail.duplicate")}
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            <Download size={14} />
            {t("conceptSets.detail.export")}
          </button>

          <button
            type="button"
            onClick={handleTogglePublic}
            disabled={updateMutation.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
              conceptSet.is_public
                ? "border-success/30 bg-success/10 text-success"
                : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary",
            )}
          >
            {conceptSet.is_public ? (
              <Globe size={14} />
            ) : (
              <Lock size={14} />
            )}
            {conceptSet.is_public
              ? t("conceptSets.detail.visibility.public")
              : t("conceptSets.detail.visibility.private")}
          </button>

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
            {t("conceptSets.detail.delete")}
          </button>
        </div>
      </div>

      {/* Split-pane Builder */}
      <ConceptSetBuilderLayout
        activeTab={searchTab}
        onTabChange={setSearchTab}
        itemCount={conceptSet.items?.length ?? 0}
        searchPanel={
          searchTab === "keyword" ? (
            <VocabularySearchPanel
              mode="build"
              conceptSetItemIds={conceptSetItemIds}
              onAddToSet={handleAddToSet}
              initialQuery={initialQuery}
              initialFilters={initialFilters}
            />
          ) : (
            <SemanticSearchPanel
              mode="build"
              conceptSetItemIds={conceptSetItemIds}
              onAddToSet={handleAddToSet}
              initialQuery={initialQuery}
              initialFilters={initialFilters}
            />
          )
        }
        contentsPanel={
          <div className="space-y-4">
            <ConceptSetEditor conceptSet={conceptSet} />

            {conceptIds.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-accent" />
                  <h2 className="text-sm font-semibold text-text-primary">
                    {t("conceptSets.detail.recommendedConcepts")}
                  </h2>
                </div>
                <PhoebeRecommendationsPanel
                  recommendations={aggregatedData}
                  isLoading={isAggregatedLoading}
                  isError={isAggregatedError}
                  existingConceptIds={new Set(conceptIds)}
                  onAddConcept={(cid) =>
                    addPhoebeItem.mutate({
                      setId: conceptSetId!,
                      payload: {
                        concept_id: cid,
                        is_excluded: false,
                        include_descendants: true,
                        include_mapped: false,
                      },
                    })
                  }
                  onAddAll={(cids) => {
                    for (const cid of cids) {
                      addPhoebeItem.mutate({
                        setId: conceptSetId!,
                        payload: {
                          concept_id: cid,
                          is_excluded: false,
                          include_descendants: true,
                          include_mapped: false,
                        },
                      });
                    }
                  }}
                  isAddingConcept={addPhoebeItem.isPending}
                  defaultExpanded={true}
                />
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
