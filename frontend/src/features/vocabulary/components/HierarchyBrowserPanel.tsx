import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight, FolderTree, Loader2, Search, Info, X, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConceptTree } from "../hooks/useConceptTree";
import { useClinicalGroupings } from "../hooks/useClinicalGroupings";
import { useGroupingPrevalence } from "../hooks/useGroupingPrevalence";
import { useSources } from "@/features/data-sources/hooks/useSources";
import type { ConceptTreeNode, ClinicalGrouping, AnchorDetail, GroupingPrevalence } from "../types/vocabulary";

interface HierarchyBrowserPanelProps {
  mode: "browse";
  onSelectConcept: (id: number) => void;
  selectedConceptId?: number | null;
}

interface BreadcrumbEntry {
  concept_id: number;
  concept_name: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  Condition: "#E5A84B",
  Drug: "#60A5FA",
  Procedure: "#2DD4BF",
  Measurement: "#A855F7",
  Observation: "#F472B6",
  Visit: "#34D399",
};

const DOMAIN_ICONS: Record<string, string> = {
  Condition: "Dx",
  Drug: "Rx",
  Procedure: "Px",
  Measurement: "Mx",
  Observation: "Ox",
  Visit: "Vx",
};

/** Domains that use SNOMED hierarchy and benefit from clinical groupings */
const SNOMED_DOMAINS = new Set(["Condition", "Procedure", "Measurement", "Observation"]);

export function HierarchyBrowserPanel({
  onSelectConcept,
  selectedConceptId,
}: HierarchyBrowserPanelProps) {
  const [parentId, setParentId] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);
  const [filterText, setFilterText] = useState("");
  const [showGroupings, setShowGroupings] = useState(true);
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  // When viewing a multi-anchor grouping, show its anchor concepts as a sub-level
  const [groupingAnchors, setGroupingAnchors] = useState<{ groupingName: string; anchors: AnchorDetail[] } | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  const { data: nodes, isLoading } = useConceptTree(parentId, activeDomain ?? undefined);
  const { data: groupings, isLoading: groupingsLoading } = useClinicalGroupings(activeDomain);
  const { data: prevalenceData, isLoading: prevalenceLoading } = useGroupingPrevalence(activeDomain, selectedSourceId);
  const { data: sources } = useSources();

  const prevalenceMap = useMemo(() => {
    const map = new Map<number, GroupingPrevalence>();
    if (prevalenceData) {
      for (const p of prevalenceData) {
        map.set(p.grouping_id, p);
      }
    }
    return map;
  }, [prevalenceData]);

  const isRootLevel = parentId === 0;

  // Determine if we should show groupings view:
  // - We're at depth 1 (just drilled into a domain virtual root)
  // - The domain is a SNOMED domain
  // - showGroupings toggle is on
  // - We have groupings data
  const isDomainLevel = breadcrumbs.length === 1 && activeDomain !== null;
  const shouldShowGroupings = isDomainLevel && showGroupings && SNOMED_DOMAINS.has(activeDomain ?? "");

  const sortedAndFilteredNodes = useMemo(() => {
    if (!nodes) return [];
    let filtered = [...nodes];
    if (filterText.trim()) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.concept_name.toLowerCase().includes(lower) ||
          String(n.concept_id).includes(lower) ||
          n.vocabulary_id?.toLowerCase().includes(lower) ||
          n.concept_class_id?.toLowerCase().includes(lower),
      );
    }
    return filtered.sort((a, b) => a.concept_name.localeCompare(b.concept_name));
  }, [nodes, filterText]);

  const handleDrillDown = useCallback((node: ConceptTreeNode) => {
    setBreadcrumbs((prev) => [
      ...prev,
      { concept_id: node.concept_id, concept_name: node.concept_name },
    ]);
    setParentId(node.concept_id);
    setFilterText("");

    // Track which domain we're in
    if (node.concept_id < 0) {
      // Virtual domain root — set active domain
      setActiveDomain(node.domain_id);
      setShowGroupings(true);
    }
  }, []);

  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      setParentId(0);
      setActiveDomain(null);
      setShowGroupings(true);
      setGroupingAnchors(null);
      setSelectedSourceId(null);
    } else {
      const entry = breadcrumbs[index];
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setParentId(entry.concept_id);
      setGroupingAnchors(null);

      // If navigating back to domain root (index 0), restore groupings
      if (index === 0 && entry.concept_id < 0) {
        setShowGroupings(true);
      }
    }
    setFilterText("");
  }, [breadcrumbs]);

  const handleRowClick = useCallback((node: ConceptTreeNode) => {
    // Virtual roots (negative IDs) always drill down — they don't exist in vocab.concept
    if (node.concept_id < 0) {
      handleDrillDown(node);
      return;
    }

    // Nodes with children: drill down into them
    if (node.child_count > 0) {
      handleDrillDown(node);
      return;
    }

    // Leaf nodes: select for detail
    onSelectConcept(node.concept_id);
  }, [handleDrillDown, onSelectConcept]);

  const handleGroupingClick = useCallback((grouping: ClinicalGrouping) => {
    if (grouping.anchor_concept_ids.length === 0) return;

    if (grouping.anchors.length > 1) {
      // Multi-anchor: show anchor concepts as a navigable sub-level
      setBreadcrumbs((prev) => [
        ...prev,
        { concept_id: -100 - grouping.id, concept_name: grouping.name },
      ]);
      setGroupingAnchors({ groupingName: grouping.name, anchors: grouping.anchors });
      setShowGroupings(false);
      setFilterText("");
    } else {
      // Single anchor: drill directly into its children
      const anchorId = grouping.anchor_concept_ids[0];
      setBreadcrumbs((prev) => [
        ...prev,
        { concept_id: anchorId, concept_name: grouping.name },
      ]);
      setParentId(anchorId);
      setShowGroupings(false);
      setGroupingAnchors(null);
      setFilterText("");
    }
  }, []);

  const handleAnchorClick = useCallback((anchor: AnchorDetail) => {
    setBreadcrumbs((prev) => [
      ...prev,
      { concept_id: anchor.concept_id, concept_name: anchor.concept_name },
    ]);
    setParentId(anchor.concept_id);
    setGroupingAnchors(null);
    setFilterText("");
    // Also select the anchor concept so the detail panel loads
    onSelectConcept(anchor.concept_id);
  }, [onSelectConcept]);

  const handleInfoClick = useCallback((e: React.MouseEvent, node: ConceptTreeNode) => {
    e.stopPropagation();
    // Only open detail for real concepts
    if (node.concept_id > 0) {
      onSelectConcept(node.concept_id);
    }
  }, [onSelectConcept]);

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 border-b border-[#232328] bg-[#0E0E11] px-4 py-2.5 text-xs shrink-0 flex-wrap min-h-[36px]">
        <button
          type="button"
          onClick={() => handleBreadcrumbClick(-1)}
          className={cn(
            "hover:text-[#F0EDE8] transition-colors",
            breadcrumbs.length === 0 ? "text-[#C9A227] font-medium" : "text-[#8A857D]",
          )}
        >
          All Domains
        </button>
        {breadcrumbs.map((bc, i) => (
          <span key={bc.concept_id} className="flex items-center gap-1">
            <ChevronRight size={10} className="text-[#5A5650]" />
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(i)}
              className={cn(
                "hover:text-[#F0EDE8] transition-colors truncate max-w-[200px]",
                i === breadcrumbs.length - 1
                  ? "text-[#C9A227] font-medium"
                  : "text-[#8A857D]",
              )}
              title={bc.concept_name}
            >
              {bc.concept_name}
            </button>
          </span>
        ))}
      </div>

      {/* Groupings toggle — shown at domain level for SNOMED domains */}
      {isDomainLevel && SNOMED_DOMAINS.has(activeDomain ?? "") && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#232328] bg-[#0E0E11]/80 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#5A5650]">
              {shouldShowGroupings
                ? `${groupings?.length ?? 0} clinical groupings`
                : `${sortedAndFilteredNodes.length} concepts`}
            </span>
            {shouldShowGroupings && sources && sources.length > 0 && (
              <div className="relative">
                <select
                  value={selectedSourceId ?? ""}
                  onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : null)}
                  className="appearance-none rounded border border-[#232328] bg-[#1A1A1E] px-2 py-0.5 pr-5 text-[10px] text-[#8A857D] focus:border-[#C9A227]/50 focus:outline-none cursor-pointer"
                >
                  <option value="">All Sources</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.source_name}</option>
                  ))}
                </select>
                <ChevronDown size={8} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#5A5650] pointer-events-none" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowGroupings((prev) => !prev)}
            className="flex items-center gap-1 text-[10px] text-[#C9A227] hover:text-[#E5C84B] transition-colors"
          >
            {shouldShowGroupings ? (
              <>
                <List size={10} />
                Show all concepts
              </>
            ) : (
              <>
                <LayoutGrid size={10} />
                Show groupings
              </>
            )}
          </button>
        </div>
      )}

      {/* Inline filter — shown when there are enough items to warrant filtering */}
      {!isLoading && !shouldShowGroupings && groupingAnchors === null && (nodes?.length ?? 0) > 8 && (
        <div className="px-3 py-2 border-b border-[#232328] bg-[#0E0E11] shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5650]" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={`Filter ${nodes?.length ?? 0} items...`}
              className="w-full rounded-md border border-[#232328] bg-[#1A1A1E] py-1.5 pl-7 pr-7 text-xs text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#C9A227]/50 focus:outline-none focus:ring-1 focus:ring-[#C9A227]/25"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#8A857D]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Item count badge — hidden when showing groupings or anchors */}
      {!isLoading && !shouldShowGroupings && groupingAnchors === null && sortedAndFilteredNodes.length > 0 && (
        <div className="px-4 py-1.5 border-b border-[#232328] bg-[#0E0E11]/50 shrink-0">
          <span className="text-[10px] text-[#5A5650]">
            {filterText
              ? `${sortedAndFilteredNodes.length} of ${nodes?.length ?? 0} items`
              : `${sortedAndFilteredNodes.length} items`}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading || (shouldShowGroupings && groupingsLoading) ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-[#8A857D]" />
          </div>
        ) : shouldShowGroupings && groupings && groupings.length > 0 ? (
          /* Clinical grouping cards */
          <GroupingsGrid groupings={groupings} onGroupingClick={handleGroupingClick} prevalenceMap={prevalenceMap} prevalenceLoading={prevalenceLoading} />
        ) : groupingAnchors !== null ? (
          /* Multi-anchor grouping sub-level */
          <AnchorsList
            groupingName={groupingAnchors.groupingName}
            anchors={groupingAnchors.anchors}
            domainId={activeDomain ?? ""}
            onAnchorClick={handleAnchorClick}
          />
        ) : sortedAndFilteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-xs text-[#5A5650]">
              {filterText ? "No matching concepts" : "No concepts found"}
            </p>
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText("")}
                className="text-[10px] text-[#C9A227] hover:text-[#E5C84B] transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : isRootLevel ? (
          /* Domain root cards */
          <div className="grid grid-cols-2 gap-2 p-1">
            {sortedAndFilteredNodes.map((node) => {
              const color = DOMAIN_COLORS[node.domain_id] ?? "#8A857D";
              const icon = DOMAIN_ICONS[node.domain_id] ?? "?";
              return (
                <button
                  key={node.concept_id}
                  type="button"
                  onClick={() => handleDrillDown(node)}
                  className="flex flex-col items-start gap-2 rounded-lg border border-[#232328] bg-[#1A1A1E] p-3 text-left transition-all hover:bg-[#232328] hover:border-[#323238] group"
                >
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {icon}
                    </span>
                    <span className="text-sm font-medium text-[#F0EDE8] truncate flex-1">
                      {node.concept_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] text-[#5A5650]">
                      {(node.descendant_count ?? node.child_count).toLocaleString()} concepts
                    </span>
                    <ChevronRight size={12} className="text-[#5A5650] group-hover:text-[#8A857D] transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Child concept list */
          <div className="space-y-0.5">
            {sortedAndFilteredNodes.map((node) => {
              const isSelected = selectedConceptId === node.concept_id && node.concept_id > 0;
              const hasChildren = node.child_count > 0;
              const color = DOMAIN_COLORS[node.domain_id] ?? "#8A857D";

              return (
                <div
                  key={node.concept_id}
                  className={cn(
                    "w-full flex items-center gap-1 rounded-md transition-colors group cursor-pointer",
                    isSelected
                      ? "bg-[#2DD4BF]/10 border border-[#2DD4BF]/30"
                      : "hover:bg-[#1C1C20] border border-transparent",
                  )}
                  onClick={() => handleRowClick(node)}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
                    {/* Domain color indicator */}
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />

                    {/* Folder / leaf icon */}
                    {hasChildren ? (
                      <FolderTree size={12} className="text-[#8A857D] shrink-0" />
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}

                    {/* Name */}
                    <span className={cn(
                      "text-xs truncate flex-1",
                      isSelected ? "text-[#2DD4BF] font-medium" : "text-[#F0EDE8]",
                    )}>
                      {node.concept_name}
                    </span>

                    {/* Metadata badges */}
                    {node.vocabulary_id && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-[#C9A227]/10 text-[#C9A227]/70 shrink-0 hidden group-hover:inline-flex">
                        {node.vocabulary_id}
                      </span>
                    )}

                    {/* Concept ID (only for real concepts) */}
                    {node.concept_id > 0 && (
                      <span className="text-[9px] text-[#5A5650] font-['IBM_Plex_Mono',monospace] shrink-0">
                        {node.concept_id}
                      </span>
                    )}

                    {/* Child count */}
                    {hasChildren && (
                      <span className="text-[9px] text-[#8A857D] shrink-0">
                        ({node.child_count.toLocaleString()})
                      </span>
                    )}
                  </div>

                  {/* Info button — opens detail panel without drilling down */}
                  {node.concept_id > 0 && hasChildren && (
                    <button
                      type="button"
                      aria-label={`View details for ${node.concept_name}`}
                      onClick={(e) => handleInfoClick(e, node)}
                      className="shrink-0 px-2 py-2 text-[#5A5650] transition-colors hover:text-[#2DD4BF] opacity-0 group-hover:opacity-100"
                      title="View concept details"
                    >
                      <Info size={12} />
                    </button>
                  )}

                  {/* Drill indicator for items with children */}
                  {hasChildren && (
                    <ChevronRight
                      size={10}
                      className="shrink-0 mr-2 text-[#5A5650] group-hover:text-[#8A857D] transition-colors"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Grid of clinical grouping cards */
function GroupingsGrid({
  groupings,
  onGroupingClick,
  prevalenceMap,
  prevalenceLoading,
}: {
  groupings: ClinicalGrouping[];
  onGroupingClick: (g: ClinicalGrouping) => void;
  prevalenceMap?: Map<number, GroupingPrevalence>;
  prevalenceLoading?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1">
      {groupings.map((g) => {
        const accentColor = g.color ?? DOMAIN_COLORS[g.domain_id] ?? "#8A857D";
        const prev = prevalenceMap?.get(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onGroupingClick(g)}
            className="flex flex-col items-start rounded-lg border border-[#232328] bg-[#1A1A1E] text-left transition-all hover:bg-[#232328] hover:border-[#323238] group overflow-hidden"
          >
            <div className="flex w-full">
              {/* Left accent bar */}
              <div
                className="w-[3px] shrink-0 rounded-l-lg"
                style={{ backgroundColor: accentColor }}
              />
              <div className="flex flex-col gap-1 p-3 min-w-0 flex-1">
                <span className="text-xs font-medium text-[#F0EDE8] truncate">
                  {g.name}
                </span>
                {g.description && (
                  <span className="text-[10px] text-[#8A857D] line-clamp-2 leading-tight">
                    {g.description}
                  </span>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-[#5A5650]">
                    {g.anchors.length > 1
                      ? `${g.anchors.length} subcategories`
                      : g.anchors[0]?.concept_name ?? "1 anchor"}
                  </span>
                  <ChevronRight
                    size={10}
                    className="text-[#5A5650] group-hover:text-[#8A857D] transition-colors"
                  />
                </div>
                {/* Prevalence badges */}
                {prevalenceLoading ? (
                  <div className="flex gap-2 mt-1">
                    <span className="h-3 w-16 rounded bg-[#232328] animate-pulse" />
                    <span className="h-3 w-16 rounded bg-[#232328] animate-pulse" />
                  </div>
                ) : prev && (prev.person_count > 0 || prev.record_count > 0) ? (
                  <div className="flex gap-2 mt-1">
                    {prev.person_count > 0 && (
                      <span className="text-[9px] text-[#5A5650]">
                        {formatCount(prev.person_count)} persons
                      </span>
                    )}
                    {prev.record_count > 0 && (
                      <span className="text-[9px] text-[#5A5650]">
                        {formatCount(prev.record_count)} records
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** Anchor concept sub-level for multi-anchor groupings */
function AnchorsList({
  groupingName,
  anchors,
  domainId,
  onAnchorClick,
}: {
  groupingName: string;
  anchors: AnchorDetail[];
  domainId: string;
  onAnchorClick: (anchor: AnchorDetail) => void;
}) {
  const color = DOMAIN_COLORS[domainId] ?? "#8A857D";

  return (
    <div className="space-y-1 p-1">
      <p className="px-2 py-1 text-[10px] text-[#5A5650]">
        {groupingName} covers {anchors.length} subcategories
      </p>
      {anchors.map((anchor) => (
        <button
          key={anchor.concept_id}
          type="button"
          onClick={() => onAnchorClick(anchor)}
          className="w-full flex items-center gap-2 rounded-lg border border-[#232328] bg-[#1A1A1E] px-4 py-3 text-left transition-all hover:bg-[#232328] hover:border-[#323238] group"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <FolderTree size={12} className="text-[#8A857D] shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-xs font-medium text-[#F0EDE8] truncate">
              {anchor.concept_name}
            </span>
            <span className="text-[9px] text-[#5A5650]">
              {anchor.vocabulary_id} {anchor.concept_class_id}
            </span>
          </div>
          <span className="text-[9px] text-[#5A5650] font-['IBM_Plex_Mono',monospace] shrink-0">
            {anchor.concept_id}
          </span>
          <ChevronRight
            size={10}
            className="shrink-0 text-[#5A5650] group-hover:text-[#8A857D] transition-colors"
          />
        </button>
      ))}
    </div>
  );
}
