import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Database,
  ChevronDown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { getCohortDefinitions } from "@/features/cohort-definitions/api/cohortApi";
import { useCohortMembers } from "../hooks/useProfiles";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface CohortMemberListProps {
  onSelectPerson: (sourceId: number, personId: number) => void;
}

export function CohortMemberList({
  onSelectPerson,
}: CohortMemberListProps) {
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [cohortId, setCohortId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [directPersonId, setDirectPersonId] = useState("");

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const { data: cohortData, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohort-definitions", { page: 1, limit: 200 }],
    queryFn: () => getCohortDefinitions({ page: 1, limit: 200 }),
    enabled: sourceId != null && sourceId > 0,
  });

  const cohorts = cohortData?.items ?? [];

  const {
    data: membersData,
    isLoading: loadingMembers,
    error: membersError,
  } = useCohortMembers(sourceId, cohortId, page);

  const members = membersData?.data ?? [];
  const totalPages = membersData?.meta?.last_page ?? 1;
  const total = membersData?.meta?.total ?? 0;
  const perPage = membersData?.meta?.per_page ?? 15;

  const handleDirectSearch = () => {
    const pid = Number(directPersonId);
    if (pid > 0 && sourceId) {
      onSelectPerson(sourceId, pid);
    }
  };

  return (
    <div className="space-y-6">
      {/* Source and Cohort Selection */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Select Patient
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Selector */}
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Data Source
            </label>
            <div className="relative">
              <Database
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
              />
              <select
                value={sourceId ?? ""}
                onChange={(e) => {
                  setSourceId(Number(e.target.value) || null);
                  setCohortId(null);
                  setPage(1);
                }}
                disabled={loadingSources}
                className={cn(
                  "w-full appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] pl-8 pr-8 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              >
                <option value="">Select a data source...</option>
                {sources?.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.source_name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
              />
            </div>
          </div>

          {/* Cohort Selector */}
          <div>
            <label className="block text-xs font-medium text-[#8A857D] mb-1">
              Cohort
            </label>
            <div className="relative">
              <Users
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
              />
              <select
                value={cohortId ?? ""}
                onChange={(e) => {
                  setCohortId(Number(e.target.value) || null);
                  setPage(1);
                }}
                disabled={!sourceId || loadingCohorts}
                className={cn(
                  "w-full appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] pl-8 pr-8 py-2 text-sm",
                  "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                  "disabled:opacity-50",
                )}
              >
                <option value="">Select a cohort...</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
              />
            </div>
          </div>
        </div>

        {/* Direct Person ID */}
        <div>
          <label className="block text-xs font-medium text-[#8A857D] mb-1">
            Or enter Person ID directly
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
              />
              <input
                type="number"
                value={directPersonId}
                onChange={(e) => setDirectPersonId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDirectSearch();
                }}
                placeholder="Enter person ID..."
                className={cn(
                  "w-full rounded-lg border border-[#232328] bg-[#0E0E11] pl-8 pr-3 py-2 text-sm",
                  "text-[#F0EDE8] placeholder:text-[#5A5650]",
                  "focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                )}
              />
            </div>
            <button
              type="button"
              onClick={handleDirectSearch}
              disabled={
                !sourceId || !directPersonId || Number(directPersonId) <= 0
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
            >
              <Search size={14} />
              View Profile
            </button>
          </div>
        </div>
      </div>

      {/* Members Table */}
      {sourceId && cohortId && (
        <div className="space-y-4">
          {loadingMembers ? (
            <div className="flex items-center justify-center h-48">
              <Loader2
                size={24}
                className="animate-spin text-[#8A857D]"
              />
            </div>
          ) : membersError ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-[#E85A6B] text-sm">
                Failed to load cohort members
              </p>
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-12">
              <Users size={24} className="text-[#5A5650] mb-3" />
              <p className="text-sm text-[#8A857D]">
                No members found in this cohort
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#1C1C20]">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Person ID
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Gender
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Year of Birth
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Cohort Start
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                        Cohort End
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, i) => (
                      <tr
                        key={member.subject_id}
                        onClick={() =>
                          onSelectPerson(sourceId, member.subject_id)
                        }
                        className={cn(
                          "border-t border-[#1C1C20] transition-colors hover:bg-[#1C1C20] cursor-pointer",
                          i % 2 === 0
                            ? "bg-[#151518]"
                            : "bg-[#1A1A1E]",
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-[#2DD4BF]">
                          {member.subject_id}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#C5C0B8]">
                          {member.gender ?? "--"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#C5C0B8]">
                          {member.year_of_birth ?? "--"}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8A857D]">
                          {formatDate(member.cohort_start_date)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8A857D]">
                          {formatDate(member.cohort_end_date)}
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
                      onClick={() => setPage(Math.max(1, page - 1))}
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
                        setPage(Math.min(totalPages, page + 1))
                      }
                      disabled={page >= totalPages}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
