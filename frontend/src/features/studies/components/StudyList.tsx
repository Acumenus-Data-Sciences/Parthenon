import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Briefcase,
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

function formatStudyType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#8A857D",
  protocol_development: "#60A5FA",
  feasibility: "#A78BFA",
  irb_review: "#F59E0B",
  recruitment: "#FB923C",
  execution: "#2DD4BF",
  analysis: "#34D399",
  synthesis: "#818CF8",
  manuscript: "#C084FC",
  published: "#22D3EE",
  archived: "#6B7280",
  withdrawn: "#E85A6B",
  running: "#F59E0B",
  completed: "#2DD4BF",
  failed: "#E85A6B",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#E85A6B",
  high: "#F59E0B",
  medium: "#60A5FA",
  low: "#8A857D",
};

interface StudyListProps {
  studies: Study[];
  onSelect: (slugOrId: string | number) => void;
  isLoading?: boolean;
  error?: Error | null;
  page?: number;
  totalPages?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  searchActive?: boolean;
}

export function StudyList({
  studies,
  onSelect,
  isLoading,
  error,
  page = 1,
  totalPages = 1,
  total = 0,
  perPage = 20,
  onPageChange,
  searchActive = false,
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
          <Briefcase size={24} className="text-[#8A857D]" />
        </div>
        <h3 className="text-lg font-semibold text-[#F0EDE8]">
          {searchActive ? "No matching studies" : "No studies yet"}
        </h3>
        <p className="mt-2 text-sm text-[#8A857D]">
          {searchActive
            ? "Try adjusting your search terms."
            : "Create your first study to orchestrate federated research."}
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
                Title
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Type
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Priority
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                PI
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {studies.map((study, i) => {
              const statusColor = STATUS_COLORS[study.status] ?? "#8A857D";
              const priorityColor = PRIORITY_COLORS[study.priority] ?? "#8A857D";

              return (
                <tr
                  key={study.id}
                  onClick={() => onSelect(study.slug || study.id)}
                  className={cn(
                    "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                    i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#F0EDE8]">
                          {study.title}
                        </p>
                        {study.short_title && (
                          <span className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-bold bg-[#C9A227]/15 text-[#C9A227]">
                            {study.short_title}
                          </span>
                        )}
                      </div>
                      {study.description && (
                        <p className="text-xs text-[#8A857D] truncate max-w-[400px]">
                          {study.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/10 text-[#2DD4BF]">
                      {formatStudyType(study.study_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${statusColor}15`,
                        color: statusColor,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: statusColor }}
                      />
                      {study.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium uppercase"
                      style={{
                        backgroundColor: `${priorityColor}15`,
                        color: priorityColor,
                      }}
                    >
                      {study.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8A857D]">
                    {study.principal_investigator?.name ?? study.author?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8A857D]">
                    {formatDate(study.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-[#8A857D]">
            Showing {(page - 1) * perPage + 1} –{" "}
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
