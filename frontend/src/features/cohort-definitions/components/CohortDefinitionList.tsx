import { useState, useEffect } from "react";
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
  Globe,
  Lock,
  Stethoscope,
  Plus,
  Database,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useCohortDefinitions } from "../hooks/useCohortDefinitions";
import type { CohortGeneration, GenerationSource } from "../types/cohortExpression";

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

function SourceBadges({ sources }: { sources?: GenerationSource[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {sources.map((s) => (
        <span
          key={s.source_id}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#60A5FA]/10 text-[#60A5FA] border border-[#60A5FA]/20"
          title={`${s.person_count?.toLocaleString() ?? '?'} patients — ${s.completed_at ? new Date(s.completed_at).toLocaleDateString() : ''}`}
        >
          <Database size={8} />
          {s.source_name ?? `Source ${s.source_id}`}
          {s.person_count !== null && (
            <span className="opacity-70">({s.person_count.toLocaleString()})</span>
          )}
        </span>
      ))}
    </div>
  );
}

interface Props {
  tags?: string[];
  search?: string;
  isPublic?: boolean;
  withGenerations?: boolean;
  onCreateFromBundle?: () => void;
}

export function CohortDefinitionList({ tags, search, isPublic, withGenerations, onCreateFromBundle }: Props) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [myOnly, setMyOnly] = useState(true);
  const currentUser = useAuthStore((s) => s.user);
  const limit = 20;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, tags, isPublic, withGenerations, myOnly]);

  const { data, isLoading, error } = useCohortDefinitions({
    page,
    limit,
    tags,
    search,
    is_public: isPublic || undefined,
    with_generations: withGenerations || undefined,
    author_id: myOnly && currentUser ? currentUser.id : undefined,
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
        <p className="text-[#E85A6B]">Failed to load cohort definitions</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const engine = data?.engine;

  if (items.length === 0 && page === 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1C1C20] mb-4">
          <Layers size={24} className="text-[#8A857D]" />
        </div>
        <h3 className="text-lg font-semibold text-[#F0EDE8]">
          {search ? "No matching cohort definitions" : "No cohort definitions"}
        </h3>
        <p className="mt-2 text-sm text-[#8A857D] max-w-md text-center">
          {search
            ? `No results for "${search}". Try a different search term.`
            : "Cohort definitions let you define inclusion and exclusion criteria to identify patient populations for research studies."}
        </p>
        {!search && (
          <div className="flex items-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => navigate("/cohort-definitions")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
            >
              <Plus size={16} />
              New Cohort Definition
            </button>
            {onCreateFromBundle && (
              <button
                type="button"
                onClick={onCreateFromBundle}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A30] bg-[#151518] px-4 py-2.5 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
              >
                <Stethoscope size={16} />
                Create from Care Bundle
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* My / All toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-[#1C1C20] p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setMyOnly(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            myOnly
              ? "bg-[#232328] text-[#F0EDE8] shadow-sm"
              : "text-[#8A857D] hover:text-[#C5C0B8]",
          )}
        >
          <User size={12} />
          My Definitions
        </button>
        <button
          type="button"
          onClick={() => setMyOnly(false)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            !myOnly
              ? "bg-[#232328] text-[#F0EDE8] shadow-sm"
              : "text-[#8A857D] hover:text-[#C5C0B8]",
          )}
        >
          <Globe size={12} />
          All Definitions
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1C1C20]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Name
              </th>
              {!myOnly && (
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                  Author
                </th>
              )}
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Tags
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Latest Generation
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Generated Against
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
                  <div className="flex items-center gap-2">
                    {def.is_public ? (
                      <Globe size={12} className="text-[#60A5FA] shrink-0" />
                    ) : (
                      <Lock size={12} className="text-[#5A5650] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#F0EDE8] truncate">
                        {def.name}
                      </p>
                      {def.description && (
                        <p className="text-[10px] text-[#5A5650] truncate max-w-[250px]">
                          {def.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                {!myOnly && (
                  <td className="px-4 py-3">
                    <p className="text-xs text-[#8A857D]">
                      {def.author?.name ?? "--"}
                    </p>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {def.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block rounded px-1.5 py-0.5 text-[10px] bg-[#1A1A1F] text-[#8A857D] border border-[#2A2A30]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <LatestGenerationBadge generations={def.generations} />
                </td>
                <td className="px-4 py-3">
                  <SourceBadges sources={def.generation_sources} />
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
          <p className="text-xs text-[#8A857D] flex items-center gap-2">
            Showing {(page - 1) * limit + 1} -{" "}
            {Math.min(page * limit, total)} of {total}
            {engine === "solr" && (
              <span className="inline-flex items-center rounded-full bg-[#2DD4BF]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#2DD4BF]">
                Solr
              </span>
            )}
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
