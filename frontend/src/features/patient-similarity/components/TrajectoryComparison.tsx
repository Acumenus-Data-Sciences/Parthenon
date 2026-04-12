import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2, AlertCircle, TrendingUp } from "lucide-react";
import { fetchTemporalSimilarity } from "../api/patientSimilarityApi";
import type { TemporalMeasurementComparison } from "../types/patientSimilarity";

interface TrajectoryComparisonProps {
  sourceId: number;
  personAId: number;
  personBId: number;
}

export function TrajectoryComparison({
  sourceId,
  personAId,
  personBId,
}: TrajectoryComparisonProps) {
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(
    null,
  );

  const {
    data: temporalData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["temporal-similarity", sourceId, personAId, personBId],
    queryFn: () => fetchTemporalSimilarity(sourceId, personAId, personBId),
    enabled: sourceId > 0 && personAId > 0 && personBId > 0,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border-default bg-surface-raised p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-success" />
          <span className="ml-3 text-sm text-text-muted">
            Computing trajectory similarity...
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-critical/20 bg-critical/5 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-critical" />
          <span className="text-sm text-critical">
            Failed to compute temporal trajectory comparison.
          </span>
        </div>
      </div>
    );
  }

  if (
    !temporalData ||
    temporalData.per_measurement.length === 0
  ) {
    return (
      <div className="rounded-lg border border-border-subtle bg-surface-base/50 p-4 opacity-60">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-text-ghost" />
          <span className="text-xs text-text-ghost font-semibold uppercase tracking-wider">
            Temporal Trajectory
          </span>
        </div>
        <p className="mt-2 text-xs text-text-ghost">
          No shared temporal measurements found between these patients.
        </p>
      </div>
    );
  }

  // Sort by similarity ascending (most different first)
  const sortedMeasurements = [...temporalData.per_measurement].sort(
    (a, b) => a.similarity - b.similarity,
  );

  const activeConceptId = selectedConceptId ?? sortedMeasurements[0]?.concept_id ?? null;
  const selectedMeasurement = temporalData.per_measurement.find(
    (m) => m.concept_id === activeConceptId,
  );

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-info" />
          <h3 className="text-[10px] text-text-ghost uppercase tracking-wider font-semibold">
            Temporal Trajectory Comparison
          </h3>
        </div>
        <span
          className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded"
          style={{
            color:
              temporalData.overall_similarity >= 0.7
                ? "var(--success)"
                : temporalData.overall_similarity >= 0.4
                  ? "var(--accent)"
                  : "var(--text-muted)",
            backgroundColor:
              temporalData.overall_similarity >= 0.7
                ? "#2DD4BF15"
                : temporalData.overall_similarity >= 0.4
                  ? "#C9A22715"
                  : "#8A857D15",
          }}
        >
          DTW Similarity: {temporalData.overall_similarity.toFixed(3)}
        </span>
      </div>

      {/* Measurement selector */}
      <div>
        <select
          value={activeConceptId ?? ""}
          onChange={(e) => setSelectedConceptId(Number(e.target.value))}
          className="w-full rounded-md border border-border-default bg-surface-base px-3 py-1.5 text-sm text-text-secondary focus:border-info focus:outline-none"
        >
          {sortedMeasurements.map((m) => (
            <option key={m.concept_id} value={m.concept_id}>
              {m.concept_name} (similarity: {m.similarity.toFixed(3)})
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      {selectedMeasurement && (
        <TrajectoryChart
          measurement={selectedMeasurement}
          personAId={personAId}
          personBId={personBId}
        />
      )}

      {/* Stats row */}
      {selectedMeasurement && (
        <div className="grid grid-cols-4 gap-3">
          <StatCell
            label="DTW Distance"
            value={selectedMeasurement.dtw_distance.toFixed(4)}
          />
          <StatCell
            label="Similarity"
            value={selectedMeasurement.similarity.toFixed(4)}
          />
          <StatCell
            label="Patient A Points"
            value={String(selectedMeasurement.series_a.length)}
          />
          <StatCell
            label="Patient B Points"
            value={String(selectedMeasurement.series_b.length)}
          />
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-base px-3 py-2">
      <div className="text-[10px] text-text-ghost uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm text-text-secondary font-medium tabular-nums mt-0.5">
        {value}
      </div>
    </div>
  );
}

function TrajectoryChart({
  measurement,
  personAId,
  personBId,
}: {
  measurement: TemporalMeasurementComparison;
  personAId: number;
  personBId: number;
}) {
  // Merge both series into a unified dataset for Recharts
  const dateSet = new Set<string>();
  for (const pt of measurement.series_a) dateSet.add(pt.date);
  for (const pt of measurement.series_b) dateSet.add(pt.date);

  const sortedDates = [...dateSet].sort();

  const aMap = new Map(measurement.series_a.map((p) => [p.date, p.value]));
  const bMap = new Map(measurement.series_b.map((p) => [p.date, p.value]));

  const chartData = sortedDates.map((date) => ({
    date,
    patientA: aMap.get(date) ?? null,
    patientB: bMap.get(date) ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "var(--text-ghost)", fontSize: 10 }}
          tickLine={{ stroke: "var(--surface-elevated)" }}
          axisLine={{ stroke: "var(--surface-elevated)" }}
        />
        <YAxis
          tick={{ fill: "var(--text-ghost)", fontSize: 10 }}
          tickLine={{ stroke: "var(--surface-elevated)" }}
          axisLine={{ stroke: "var(--surface-elevated)" }}
          label={{
            value: "Value",
            angle: -90,
            position: "insideLeft",
            style: { fill: "var(--text-ghost)", fontSize: 10 },
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--surface-raised)",
            border: "1px solid #232328",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--text-secondary)" }}
          formatter={
            ((value: number) => [
              value != null ? value.toFixed(2) : "N/A",
              "",
            ]) as never
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
        />
        <Line
          type="monotone"
          dataKey="patientA"
          name={`Patient #${personAId}`}
          stroke="var(--success)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="patientB"
          name={`Patient #${personBId}`}
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
