import { useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  MappingAction,
  ConceptMapping,
} from "@/types/ingestion";
import {
  fetchMappings,
  fetchMappingStats,
  submitReview,
  submitBatchReview,
  fetchCandidates,
  searchMappings,
} from "../api/ingestionApi";
import { ReviewStatsBar } from "../components/ReviewStatsBar";
import { MappingCard } from "../components/MappingCard";
import { ConceptBrowser } from "../components/ConceptBrowser";
import { BatchReviewToolbar } from "../components/BatchReviewToolbar";

type FilterTab = "all" | "quick_review" | "full_review" | "unmappable" | "reviewed";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "quick_review", label: "Quick Review" },
  { key: "full_review", label: "Full Review" },
  { key: "unmappable", label: "Unmappable" },
  { key: "reviewed", label: "Reviewed" },
];

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export default function MappingReviewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const queryClient = useQueryClient();
  const id = Number(jobId);

  // UI state
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [browserMappingId, setBrowserMappingId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast helper
  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      const toastId = Date.now();
      setToasts((prev) => [...prev, { id: toastId, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 3000);
    },
    [],
  );

  // Build filter params
  const filterParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (activeTab === "reviewed") {
      params.is_reviewed = "true";
    } else if (activeTab !== "all") {
      params.review_tier = activeTab;
    }
    return params;
  }, [activeTab]);

  // Queries
  const {
    data: mappings,
    isLoading: mappingsLoading,
    error: mappingsError,
  } = useQuery({
    queryKey: ["mappings", id, filterParams],
    queryFn: () => fetchMappings(id, filterParams),
    enabled: !isNaN(id),
  });

  const { data: stats } = useQuery({
    queryKey: ["mapping-stats", id],
    queryFn: () => fetchMappingStats(id),
    enabled: !isNaN(id),
  });

  // Solr facet query for review_tier counts
  const { data: solrFacets } = useQuery({
    queryKey: ["mapping-facets", id],
    queryFn: () => searchMappings({ ingestion_job_id: id, limit: 0 }),
    enabled: !isNaN(id),
    staleTime: 30_000,
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: ({
      mappingId,
      action,
      targetConceptId,
    }: {
      mappingId: number;
      action: MappingAction;
      targetConceptId?: number;
    }) =>
      submitReview(id, mappingId, {
        action,
        target_concept_id: targetConceptId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mappings", id] });
      queryClient.invalidateQueries({ queryKey: ["mapping-stats", id] });
      showToast("Review submitted successfully");
    },
    onError: () => {
      showToast("Failed to submit review", "error");
    },
  });

  // Batch review mutation
  const batchMutation = useMutation({
    mutationFn: (action: MappingAction) => {
      const reviews = Array.from(selectedIds).map((mappingId) => {
        const mapping = mappings?.find(
          (m: ConceptMapping) => m.id === mappingId,
        );
        return {
          mapping_id: mappingId,
          action,
          target_concept_id:
            action === "approve"
              ? mapping?.candidates?.[0]?.target_concept_id
              : undefined,
        };
      });
      return submitBatchReview(id, { reviews });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mappings", id] });
      queryClient.invalidateQueries({ queryKey: ["mapping-stats", id] });
      setSelectedIds(new Set());
      showToast(`Batch review: ${data.reviewed} mappings updated`);
    },
    onError: () => {
      showToast("Batch review failed", "error");
    },
  });

  // Expand handler -- fetch candidates on expand
  const handleToggleExpand = useCallback(
    (mappingId: number) => {
      if (expandedId === mappingId) {
        setExpandedId(null);
        return;
      }
      setExpandedId(mappingId);
      // Prefetch candidates
      queryClient.prefetchQuery({
        queryKey: ["candidates", id, mappingId],
        queryFn: () => fetchCandidates(id, mappingId),
      });
    },
    [expandedId, id, queryClient],
  );

  // Selection helpers
  const toggleSelect = useCallback((mappingId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(mappingId)) {
        next.delete(mappingId);
      } else {
        next.add(mappingId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!mappings) return;
    setSelectedIds(new Set(mappings.map((m: ConceptMapping) => m.id)));
  }, [mappings]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected =
    !!mappings &&
    mappings.length > 0 &&
    mappings.every((m: ConceptMapping) => selectedIds.has(m.id));

  // Review handler
  const handleReview = useCallback(
    (
      mappingId: number,
      action: MappingAction,
      targetConceptId?: number,
    ) => {
      reviewMutation.mutate({ mappingId, action, targetConceptId });
    },
    [reviewMutation],
  );

  // Concept browser remap handler
  const handleBrowserSelect = useCallback(
    (conceptId: number, _conceptName: string) => {
      if (browserMappingId === null) return;
      reviewMutation.mutate({
        mappingId: browserMappingId,
        action: "remap",
        targetConceptId: conceptId,
      });
      setBrowserMappingId(null);
    },
    [browserMappingId, reviewMutation],
  );

  // Loading state
  if (mappingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  // Error state
  if (mappingsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle size={32} className="text-[#E85A6B]" />
        <p className="text-[#E85A6B]">Failed to load mappings</p>
        <Link
          to={`/ingestion/jobs/${jobId}`}
          className="text-sm text-[#8A857D] hover:text-[#F0EDE8] underline"
        >
          Back to job
        </Link>
      </div>
    );
  }

  const showBrowser = browserMappingId !== null;

  return (
    <div className="min-h-screen">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg",
              "animate-in slide-in-from-right",
              toast.type === "success"
                ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30"
                : "bg-[#E85A6B]/15 text-[#E85A6B] border border-[#E85A6B]/30",
            )}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to={`/ingestion/jobs/${jobId}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1C1C20] transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#F0EDE8]">
            Mapping Review
          </h1>
          <p className="text-sm text-[#8A857D]">
            Job #{jobId} &mdash; Review and approve concept mappings
          </p>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4">
        {/* Left panel */}
        <div
          className={cn(
            "flex-1 min-w-0 space-y-4",
            showBrowser ? "w-[60%]" : "w-full",
          )}
        >
          {/* Stats bar */}
          {stats && (
            <div
              className="rounded-lg border border-[#232328] p-4"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <ReviewStatsBar stats={stats} />
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex items-center gap-0 border-b border-[#232328]">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedIds(new Set());
                }}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "text-[#F0EDE8]"
                    : "text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                {tab.label}
                {solrFacets?.facets?.review_tier &&
                  tab.key !== "all" &&
                  tab.key !== "reviewed" &&
                  solrFacets.facets.review_tier[tab.key] != null && (
                    <span className="ml-1.5 text-xs text-[#5A5650]">
                      {solrFacets.facets.review_tier[tab.key]}
                    </span>
                  )}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9B1B30] rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Batch toolbar */}
          <BatchReviewToolbar
            selectedCount={selectedIds.size}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onBatchAccept={() => batchMutation.mutate("approve")}
            onBatchReject={() => batchMutation.mutate("reject")}
            isAllSelected={isAllSelected}
          />

          {/* Mapping list */}
          <div className="space-y-2">
            {!mappings || mappings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-[#232328] bg-[#151518] py-16">
                <p className="text-sm text-[#5A5650]">
                  No mappings found for this filter
                </p>
              </div>
            ) : (
              mappings.map((mapping: ConceptMapping) => (
                <MappingCard
                  key={mapping.id}
                  mapping={mapping}
                  onReview={handleReview}
                  isExpanded={expandedId === mapping.id}
                  onToggleExpand={() => handleToggleExpand(mapping.id)}
                  isSelected={selectedIds.has(mapping.id)}
                  onToggleSelect={() => toggleSelect(mapping.id)}
                  onOpenBrowser={() => setBrowserMappingId(mapping.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel - Concept Browser */}
        {showBrowser && (
          <div
            className={cn(
              "w-[40%] shrink-0 rounded-lg border border-[#232328] bg-[#151518]",
              "sticky top-4 self-start max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col",
            )}
          >
            {/* Close bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#232328] bg-[#0E0E11]">
              <span className="text-xs text-[#8A857D]">
                Remap for mapping #{browserMappingId}
              </span>
              <button
                type="button"
                onClick={() => setBrowserMappingId(null)}
                className="text-xs text-[#5A5650] hover:text-[#F0EDE8] transition-colors"
              >
                Close
              </button>
            </div>
            <ConceptBrowser onSelectConcept={handleBrowserSelect} />
          </div>
        )}
      </div>
    </div>
  );
}
