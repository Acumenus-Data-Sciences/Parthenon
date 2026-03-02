import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortDefinitions } from "../hooks/useCohortDefinitions";
import type { CohortGeneration } from "../types/cohortExpression";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LatestGenerationBadge({
  generations,
}: {
  generations?: CohortGeneration[];
}) {
  if (!generations || generations.length === 0) {
    return (
      <span className="text-xs text-[#5A5650]">No generations</span>
    );
  }

  // Find the most recent generation
  const latest = generations.reduce((a, b) =>
    new Date(b.started_at ?? 0) > new Date(a.started_at ?? 0) ? b : a,
  );

  const config = {
    pending: { icon: Clock, color: "#8A857D", label: "Pending" },
    queued: { icon: Clock, color: "#C9A227", label: "Queued" },
    running: { icon: Loader2, color: "#60A5FA", label: "Running" },
    completed: { icon: CheckCircle2, color: "#2DD4BF", label: "Completed" },
    failed: { icon: XCircle, color: "#E85A6B", label: "Failed" },
    cancelled: { icon: Clock, color: "#8A857D", label: "Cancelled" },
  }[latest.status];

  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: `${config.color}15`,
          color: config.color,
        }}
      >
        <Icon
          size={10}
          className={latest.status === "running" ? "animate-spin" : ""}
        />
        {config.label}
      </span>
      {latest.person_count !== null && (
        <span className="inline-flex items-center gap-1 font-['IBM_Plex_Mono',monospace] text-xs text-[#2DD4BF]">
          <Users size={10} />
          {latest.person_count.toLocaleString()}
        </span>
      )}
    </div>
  );
}

export function CohortDefinitionList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useCohortDefinitions({ page, limit });

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
        <p className="text-[#E85A6B]">Failed to load cohort definitions</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (items.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1C1C20] mb-4">
          <Layers size={24} className="text-[#8A857D]" />
        </div>
        <h3 className="text-lg font-semibold text-[#F0EDE8]">
          No cohort definitions
        </h3>
        <p className="mt-2 text-sm text-[#8A857D]">
          Create your first cohort definition to start building cohorts.
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
                Description
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Latest Generation
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((def, i) => (
              <tr
                key={def.id}
                onClick={() => navigate(`/cohort-definitions/${def.id}`)}
                className={cn(
                  "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                  i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
                )}
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-[#F0EDE8]">
                    {def.name}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-[#8A857D] truncate max-w-[300px]">
                    {def.description || "--"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <LatestGenerationBadge generations={def.generations} />
                </td>
                <td className="px-4 py-3 text-sm text-[#8A857D]">
                  {formatDate(def.created_at)}
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
