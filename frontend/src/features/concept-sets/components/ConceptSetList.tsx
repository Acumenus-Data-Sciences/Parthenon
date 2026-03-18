import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Globe,
  Lock,
  Plus,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useConceptSets } from "../hooks/useConceptSets";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ConceptSetListProps {
  search?: string;
  tags?: string[];
  isPublic?: boolean;
  withItems?: boolean;
  onCreateFromBundle?: () => void;
}

export function ConceptSetList({
  search,
  tags,
  isPublic,
  withItems,
  onCreateFromBundle,
}: ConceptSetListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, tags, isPublic, withItems]);

  const { data, isLoading, error } = useConceptSets({
    page,
    limit,
    search: search || undefined,
    tags: tags?.length ? tags : undefined,
    is_public: isPublic || undefined,
    with_items: withItems || undefined,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#E85A6B]">Failed to load concept sets</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isFiltering = !!(search || (tags && tags.length > 0));

  if (items.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1C1C20] mb-4">
          <Layers size={24} className="text-[#8A857D]" />
        </div>
        <h3 className="text-lg font-semibold text-[#F0EDE8]">
          {isFiltering ? "No matching concept sets" : "No concept sets"}
        </h3>
        <p className="mt-2 text-sm text-[#8A857D]">
          {isFiltering
            ? "Try adjusting your search or tag filters."
            : "Create your first concept set to start building definitions."}
        </p>
        {!isFiltering && (
          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => navigate("/concept-sets")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
            >
              <Plus size={14} />
              New Concept Set
            </button>
            {onCreateFromBundle && (
              <button
                type="button"
                onClick={onCreateFromBundle}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
              >
                <Stethoscope size={14} />
                From Bundle
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1C1C20]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Name
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Author
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Visibility
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Items
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Tags
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((cs, i) => (
              <tr
                key={cs.id}
                onClick={() => navigate(`/concept-sets/${cs.id}`)}
                className={cn(
                  "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                  i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                )}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#F0EDE8]">
                      {cs.name}
                    </p>
                    {cs.description && (
                      <p className="mt-0.5 text-xs text-[#8A857D] truncate max-w-[300px]">
                        {cs.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#8A857D]">
                  {cs.author?.name ?? "--"}
                </td>
                <td className="px-4 py-3">
                  {cs.is_public ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#2DD4BF]">
                      <Globe size={12} />
                      Public
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-[#8A857D]">
                      <Lock size={12} />
                      Private
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#232328] px-2 py-0.5 text-xs font-medium text-[#C5C0B8]">
                    <Layers size={10} />
                    {cs.items_count ?? cs.items?.length ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {cs.tags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#C9A227]/15 text-[#C9A227]"
                      >
                        {tag}
                      </span>
                    ))}
                    {cs.tags?.length > 3 && (
                      <span className="text-[10px] text-[#5A5650]">
                        +{cs.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-[#8A857D]">
                  {formatDate(cs.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-[#8A857D]">
            Showing {(page - 1) * limit + 1} -{" "}
            {Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-[#C5C0B8] px-2">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
