import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users,
  Database,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import apiClient from "@/lib/api-client";

interface RecordCount {
  table: string;
  count: number;
}

interface AchillesRun {
  run_id: number;
  status: string;
  total_analyses: number;
  completed_analyses: number;
  started_at: string | null;
  completed_at: string | null;
}

interface CdmContextPanelProps {
  sourceId: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isComplete = normalized === "completed" || normalized === "complete";
  const isRunning = normalized === "running" || normalized === "in_progress";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: isComplete
          ? "rgba(45,212,191,0.15)"
          : isRunning
            ? "rgba(201,162,39,0.15)"
            : "rgba(232,90,107,0.15)",
        color: isComplete ? "#2DD4BF" : isRunning ? "#C9A227" : "#E85A6B",
      }}
    >
      {isComplete ? (
        <CheckCircle2 size={10} />
      ) : isRunning ? (
        <Clock size={10} />
      ) : (
        <AlertCircle size={10} />
      )}
      {status}
    </span>
  );
}

export function CdmContextPanel({ sourceId }: CdmContextPanelProps) {
  const recordCounts = useQuery({
    queryKey: ["profiler-cdm", "record-counts", sourceId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: RecordCount[] }>(
        `/sources/${sourceId}/achilles/record-counts`,
      );
      return data.data;
    },
    enabled: sourceId > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const achillesRuns = useQuery({
    queryKey: ["profiler-cdm", "runs", sourceId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AchillesRun[] }>(
        `/sources/${sourceId}/achilles/runs`,
      );
      return data.data;
    },
    enabled: sourceId > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const metrics = useMemo(() => {
    const counts = recordCounts.data ?? [];
    const runs = achillesRuns.data ?? [];
    const latestRun = runs.length > 0 ? runs[0] : null;

    const personEntry = counts.find(
      (r) => r.table.toLowerCase() === "person",
    );
    const personCount = personEntry?.count ?? 0;

    const populatedTables = counts.filter((r) => r.count > 0).length;

    const totalRecords = counts.reduce((sum, r) => sum + r.count, 0);

    const runQuality =
      latestRun && latestRun.total_analyses > 0
        ? Math.round(
            (latestRun.completed_analyses / latestRun.total_analyses) * 100,
          )
        : null;

    return { personCount, populatedTables, totalRecords, latestRun, runQuality };
  }, [recordCounts.data, achillesRuns.data]);

  const isLoading = recordCounts.isLoading || achillesRuns.isLoading;
  const hasNoData =
    !isLoading &&
    (recordCounts.isError || !recordCounts.data || recordCounts.data.length === 0);

  if (hasNoData) {
    return (
      <div
        className="rounded-lg border px-6 py-8 text-center"
        style={{ borderColor: "#2a2a3e", backgroundColor: "#1a1a2e" }}
      >
        <Database size={24} className="mx-auto mb-2 text-gray-500" />
        <p className="text-sm text-gray-400">
          No characterization data &mdash; run Achilles from{" "}
          <Link
            to={`/data-explorer/${sourceId}`}
            className="text-teal-400 underline hover:text-teal-300"
          >
            Data Explorer
          </Link>
        </p>
      </div>
    );
  }

  const cards = [
    {
      label: "Person Count",
      value: isLoading ? "..." : formatNumber(metrics.personCount),
      icon: Users,
      accent: metrics.personCount > 0,
    },
    {
      label: "Domain Coverage",
      value: isLoading
        ? "..."
        : `${metrics.populatedTables} tables`,
      icon: Layers,
      accent: metrics.populatedTables > 0,
    },
    {
      label: "Total Records",
      value: isLoading ? "..." : formatNumber(metrics.totalRecords),
      icon: Database,
      accent: metrics.totalRecords > 0,
    },
    {
      label: "Latest Run",
      value: isLoading
        ? "..."
        : metrics.latestRun
          ? formatDate(metrics.latestRun.completed_at ?? metrics.latestRun.started_at)
          : "None",
      icon: Activity,
      accent: false,
      badge: metrics.latestRun ? (
        <StatusBadge status={metrics.latestRun.status} />
      ) : null,
    },
    {
      label: "Run Quality",
      value: isLoading
        ? "..."
        : metrics.runQuality !== null
          ? `${metrics.runQuality}%`
          : "N/A",
      icon: CheckCircle2,
      accent: metrics.runQuality !== null && metrics.runQuality >= 90,
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-5 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border p-4"
            style={{ borderColor: "#2a2a3e", backgroundColor: "#1a1a2e" }}
          >
            <div className="mb-2 flex items-center gap-2">
              <card.icon size={14} className="text-gray-500" />
              <span className="text-xs uppercase tracking-wide text-gray-400">
                {card.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold"
                style={{ color: card.accent ? "#2DD4BF" : "#FFFFFF" }}
              >
                {card.value}
              </span>
              {card.badge ?? null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-right">
        <Link
          to={`/data-explorer/${sourceId}`}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-teal-400 transition-colors"
        >
          View full characterization
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
