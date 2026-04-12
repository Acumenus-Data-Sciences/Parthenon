import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Ban,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortGenerations } from "../hooks/useCohortDefinitions";
import type { CohortGeneration } from "../types/cohortExpression";

interface GenerationHistoryTableProps {
  definitionId: number | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: CohortGeneration["status"] }) {
  const config = {
    pending: { icon: Clock, color: "#8A857D", label: "Pending" },
    queued: { icon: Clock, color: "#C9A227", label: "Queued" },
    running: { icon: Loader2, color: "#60A5FA", label: "Running" },
    completed: { icon: CheckCircle2, color: "#2DD4BF", label: "Completed" },
    failed: { icon: XCircle, color: "#E85A6B", label: "Failed" },
    cancelled: { icon: Ban, color: "#8A857D", label: "Cancelled" },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
    >
      <Icon
        size={10}
        className={status === "running" ? "animate-spin" : ""}
      />
      {config.label}
    </span>
  );
}

export function GenerationHistoryTable({
  definitionId,
}: GenerationHistoryTableProps) {
  const { data: generations, isLoading, error } =
    useCohortGenerations(definitionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-[#E85A6B]">
        Failed to load generation history
      </div>
    );
  }

  if (!generations || generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-8">
        <AlertCircle size={20} className="text-[#323238] mb-2" />
        <p className="text-sm text-[#8A857D]">No generations yet</p>
        <p className="mt-1 text-xs text-[#5A5650]">
          Generate the cohort to see results here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#1C1C20]">
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
              Status
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
              Source
            </th>
            <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
              Persons
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
              Started
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
              Completed
            </th>
          </tr>
        </thead>
        <tbody>
          {generations.map((gen, i) => (
            <tr
              key={gen.id}
              className={cn(
                "border-t border-[#1C1C20] transition-colors",
                i % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]",
              )}
            >
              <td className="px-4 py-3">
                <StatusBadge status={gen.status} />
              </td>
              <td className="px-4 py-3 text-xs text-[#8A857D]">
                Source #{gen.source_id}
              </td>
              <td className="px-4 py-3 text-right">
                {gen.person_count !== null ? (
                  <span className="inline-flex items-center gap-1 font-['IBM_Plex_Mono',monospace] text-sm font-medium text-[#2DD4BF]">
                    <Users size={12} />
                    {gen.person_count.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs text-[#5A5650]">--</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-[#8A857D]">
                {formatDate(gen.started_at)}
              </td>
              <td className="px-4 py-3 text-xs text-[#8A857D]">
                {formatDate(gen.completed_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
