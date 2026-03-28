import { useState, useEffect, useMemo } from "react";
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [searchTab, setSearchTab] = useState<'keyword' | 'semantic'>('keyword');

  useEffect(() => {
    if (conceptSet) {
      setName(conceptSet.name);
      setDescription(conceptSet.description ?? "");
    }
  }, [conceptSet]);

  const initialQuery = searchParams.get('q') ?? undefined;
  const initialFilters = useMemo(() => ({
    domain: searchParams.get('domain') ?? undefined,
    vocabulary: searchParams.get('vocabulary') ?? undefined,
    standard: searchParams.get('standard') === 'true' ? true : undefined,
  }), [searchParams]);

  const conceptSetItemIds = useMemo(
    () => new Set(conceptSet?.items?.map((item) => item.concept_id) ?? []),
    [conceptSet?.items],
  );

  const handleSaveName = () => {
    if (!conceptSetId || !name.trim()) return;
    updateMutation.mutate(
      { id: conceptSetId, payload: { name: name.trim() } },
      { onSuccess: () => setIsEditingName(false) },
    );
  };

  const handleSaveDescription = () => {
    if (!conceptSetId) return;
    updateMutation.mutate(
      {
        id: conceptSetId,
        payload: { description: description.trim() || undefined },
      },
      { onSuccess: () => setIsEditingDesc(false) },
    );
  };

  const handleDelete = () => {
    if (!conceptSetId) return;
    if (window.confirm("Are you sure you want to delete this concept set?")) {
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
        toast.success(`Duplicated as "${copy.name}"`);
        navigate(`/concept-sets/${copy.id}`);
      },
      onError: () => {
        toast.error("Failed to duplicate concept set");
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
    a.download = `${conceptSet?.name ?? "concept-set"}.json`;
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
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error || !conceptSet) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-[#E85A6B]">Failed to load concept set</p>
          <button
            type="button"
            onClick={() => navigate("/concept-sets")}
            className="mt-4 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
          >
            Back to list
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
            className="inline-flex items-center gap-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Concept Sets
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
                    setName(conceptSet.name);
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
              {conceptSet.name}
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
                    setDescription(conceptSet.description ?? "");
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
                conceptSet.description
                  ? "text-[#8A857D] hover:text-[#C5C0B8]"
                  : "text-[#5A5650] hover:text-[#8A857D]",
              )}
              title="Click to edit"
            >
              {conceptSet.description ?? "Add a description..."}
            </p>
          )}

          {/* Tags */}
          {conceptSet.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {conceptSet.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#C5C0B8] transition-colors disabled:opacity-50"
          >
            {copyMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Copy size={14} />
            )}
            Duplicate
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
          >
            <Download size={14} />
            Export
          </button>

          <button
            type="button"
            onClick={handleTogglePublic}
            disabled={updateMutation.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
              conceptSet.is_public
                ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/10 text-[#2DD4BF]"
                : "border-[#232328] bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8]",
            )}
          >
            {conceptSet.is_public ? (
              <Globe size={14} />
            ) : (
              <Lock size={14} />
            )}
            {conceptSet.is_public ? "Public" : "Private"}
          </button>

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

      {/* Split-pane Builder */}
      <ConceptSetBuilderLayout
        searchPanel={
          <div>
            {/* Search tab switcher */}
            <div className="mb-3 flex gap-1">
              <button
                type="button"
                onClick={() => setSearchTab('keyword')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  searchTab === 'keyword'
                    ? 'bg-[#2DD4BF]/15 text-[#2DD4BF]'
                    : 'text-[#8A857D] hover:text-[#C5C0B8]',
                )}
              >
                Keyword
              </button>
              <button
                type="button"
                onClick={() => setSearchTab('semantic')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  searchTab === 'semantic'
                    ? 'bg-[#2DD4BF]/15 text-[#2DD4BF]'
                    : 'text-[#8A857D] hover:text-[#C5C0B8]',
                )}
              >
                Semantic
              </button>
            </div>

            {searchTab === 'keyword' ? (
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
            )}
          </div>
        }
        contentsPanel={
          <div className="space-y-4">
            <ConceptSetEditor conceptSet={conceptSet} />

            {conceptIds.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#C9A227]" />
                  <h2 className="text-sm font-semibold text-[#F0EDE8]">
                    Recommended Concepts
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
