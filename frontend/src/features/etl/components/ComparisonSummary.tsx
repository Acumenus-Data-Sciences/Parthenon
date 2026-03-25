import type { ComparisonData } from "../api";

interface ComparisonSummaryProps {
  data: ComparisonData;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

interface CardConfig {
  key: string;
  label: string;
  value: string | number;
  valueColor: string;
  bg: string;
  border: string;
  activeBorder: string;
}

export default function ComparisonSummary({
  data,
  activeFilter,
  onFilterChange,
}: ComparisonSummaryProps) {
  const { summary } = data;

  const gradeImproved = summary.grade_change.current > summary.grade_change.baseline;
  const gradeRegressed = summary.grade_change.current < summary.grade_change.baseline;
  const gradeColor = gradeImproved
    ? "text-emerald-400"
    : gradeRegressed
      ? "text-red-400"
      : "text-gray-400";

  const cards: CardConfig[] = [
    {
      key: "grade",
      label: "Grade Change",
      value: `${summary.grade_change.baseline} \u2192 ${summary.grade_change.current}`,
      valueColor: gradeColor,
      bg: "bg-gray-900/50",
      border: "border-gray-700/50",
      activeBorder: "border-gray-400",
    },
    {
      key: "regressions",
      label: "Regressions",
      value: summary.regressions,
      valueColor: "text-red-400",
      bg: "bg-red-950/30",
      border: "border-red-800/40",
      activeBorder: "border-red-500",
    },
    {
      key: "improvements",
      label: "Improvements",
      value: summary.improvements,
      valueColor: "text-emerald-400",
      bg: "bg-emerald-950/30",
      border: "border-emerald-800/40",
      activeBorder: "border-emerald-500",
    },
    {
      key: "schema_changes",
      label: "Schema Changes",
      value: summary.schema_changes,
      valueColor: "text-purple-400",
      bg: "bg-purple-950/30",
      border: "border-purple-800/40",
      activeBorder: "border-purple-500",
    },
  ];

  const showVolume =
    summary.row_count_delta.delta_pct > 10 || summary.row_count_delta.delta_pct < -10;

  if (showVolume) {
    const sign = summary.row_count_delta.delta_pct > 0 ? "+" : "";
    cards.push({
      key: "volume",
      label: "Data Volume",
      value: `${sign}${summary.row_count_delta.delta_pct.toFixed(1)}%`,
      valueColor:
        summary.row_count_delta.delta_pct > 0 ? "text-emerald-400" : "text-red-400",
      bg: "bg-amber-950/30",
      border: "border-amber-800/40",
      activeBorder: "border-amber-500",
    });
  }

  function handleClick(key: string) {
    if (key === "grade") return;
    onFilterChange(activeFilter === key ? null : key);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const isActive = activeFilter === card.key;
        const borderClass = isActive ? card.activeBorder : card.border;
        const isClickable = card.key !== "grade";

        return (
          <div
            key={card.key}
            className={`rounded-xl p-5 transition-colors border ${card.bg} ${borderClass} ${
              isClickable ? "cursor-pointer" : ""
            }`}
            onClick={() => handleClick(card.key)}
          >
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              {card.label}
            </div>
            <div className={`text-3xl font-bold ${card.valueColor}`}>{card.value}</div>
          </div>
        );
      })}
    </div>
  );
}
