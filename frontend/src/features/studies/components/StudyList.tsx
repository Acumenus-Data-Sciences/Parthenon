import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Study } from "../types/study";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface StudyListProps {
  studies: Study[];
  onSelect: (id: number) => void;
  isLoading?: boolean;
  error?: Error | null;
  page?: number;
  totalPages?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
}

export function StudyList({
  studies,
  onSelect,
  isLoading,
  error,
  page = 1,
  totalPages = 1,
  total = 0,
  perPage = 15,
  onPageChange,
}: StudyListProps) {
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
        <p className="text-[#E85A6B]">Failed to load studies</p>
      </div>
    );
  }

  if (studies.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1C1C20] mb-4">
          <BookOpen size={24} className="text-[#8A857D]" />
        </div>
        <h3 className="text-lg font-semibold text-[#F0EDE8]">
          No studies yet
        </h3>
        <p className="mt-2 text-sm text-[#8A857D]">
          Create your first study to orchestrate multiple analyses.
        </p>
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
                Type
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Analyses
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {studies.map((study, i) => (
              <tr
                key={study.id}
                onClick={() => onSelect(study.id)}
                className={cn(
                  "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                  i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                )}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#F0EDE8]">
                      {study.name}
                    </p>
                    {study.description && (
                      <p className="text-xs text-[#8A857D] truncate max-w-[300px]">
                        {study.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      study.study_type === "Estimation"
                        ? "bg-[#9B1B30]/10 text-[#E85A6B]"
                        : study.study_type === "Prediction"
                          ? "bg-[#C9A227]/10 text-[#C9A227]"
                          : "bg-[#2DD4BF]/10 text-[#2DD4BF]",
                    )}
                  >
                    {study.study_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      study.status === "completed"
                        ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                        : study.status === "running"
                          ? "bg-[#F59E0B]/10 text-[#F59E0B]"
                          : study.status === "failed"
                            ? "bg-[#E85A6B]/10 text-[#E85A6B]"
                            : "bg-[#8A857D]/10 text-[#8A857D]",
                    )}
                  >
                    {study.status || "draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#8A857D]">
                  {study.analyses?.length ?? 0}
                </td>
                <td className="px-4 py-3 text-sm text-[#8A857D]">
                  {formatDate(study.created_at)}
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
            Showing {(page - 1) * perPage + 1} -{" "}
            {Math.min(page * perPage, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
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
              onClick={() =>
                onPageChange?.(Math.min(totalPages, page + 1))
              }
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
