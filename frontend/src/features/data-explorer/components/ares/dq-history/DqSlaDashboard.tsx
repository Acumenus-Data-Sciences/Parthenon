import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useDqSlaTargets, useStoreDqSlaTargets, useDqSlaCompliance } from "../../../hooks/useDqHistoryData";
import type { DqSlaCompliance, DqSlaTargetInput } from "../../../types/ares";
import { useAuthStore } from "@/stores/authStore";

const KAHN_CATEGORIES = [
  "completeness",
  "conformance",
  "conformance_value",
  "conformance_relational",
  "plausibility",
  "plausibility_atemporal",
  "plausibility_temporal",
];

interface DqSlaDashboardProps {
  sourceId: number;
}

function SlaForm({
  sourceId,
  existingTargets,
}: {
  sourceId: number;
  existingTargets: Array<{ category: string; min_pass_rate: number }>;
}) {
  const { t } = useTranslation("app");
  const [targets, setTargets] = useState<DqSlaTargetInput[]>(
    existingTargets.length > 0
      ? existingTargets.map((t) => ({ category: t.category, min_pass_rate: t.min_pass_rate }))
      : KAHN_CATEGORIES.map((c) => ({ category: c, min_pass_rate: 90 })),
  );

  const storeMutation = useStoreDqSlaTargets(sourceId);

  const updateTarget = (index: number, rate: number) => {
    const updated = [...targets];
    updated[index] = { ...updated[index], min_pass_rate: Math.min(100, Math.max(0, rate)) };
    setTargets(updated);
  };

  const handleSave = () => {
    storeMutation.mutate(targets.filter((t) => t.min_pass_rate > 0));
  };

  return (
    <div className="mb-4 rounded-lg border border-border-subtle bg-surface-base p-4">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
        {t("dataExplorer.ares.dqHistory.sla.targetsTitle")}
      </h4>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {targets.map((t, i) => (
          <div key={t.category} className="flex items-center gap-2">
            <label className="w-32 text-xs text-text-muted capitalize">
              {t.category.replace(/_/g, " ")}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={t.min_pass_rate}
              onChange={(e) => updateTarget(i, Number(e.target.value))}
              className="w-16 rounded border border-border-default bg-surface-overlay px-2 py-1 text-xs text-text-primary"
            />
            <span className="text-xs text-text-ghost">%</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={storeMutation.isPending}
        className="mt-3 rounded bg-success px-4 py-1.5 text-xs font-medium text-black transition-colors hover:bg-success/80 disabled:opacity-50"
      >
        {storeMutation.isPending
          ? t("dataExplorer.ares.dqHistory.actions.saving")
          : t("dataExplorer.ares.dqHistory.actions.saveSlaTargets")}
      </button>
      {storeMutation.isSuccess && (
        <span className="ml-3 text-xs text-success">
          {t("dataExplorer.ares.dqHistory.messages.saved")}
        </span>
      )}
    </div>
  );
}

function ComplianceChart({ compliance }: { compliance: DqSlaCompliance[] }) {
  const { t } = useTranslation("app");

  if (compliance.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-ghost">
        {t("dataExplorer.ares.dqHistory.messages.noSlaTargets")}
      </p>
    );
  }

  const chartData = compliance.map((c) => ({
    category: c.category.replace(/_/g, " "),
    actual: c.actual,
    target: c.target,
    compliant: c.compliant,
    budget: c.error_budget_remaining,
  }));

  return (
    <div>
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
        {t("dataExplorer.ares.dqHistory.sla.currentCompliance")}
      </h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-accent)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(v: number) => t("dataExplorer.ares.networkOverview.percent", { value: formatNumber(v) })}
            />
            <YAxis type="category" dataKey="category" tick={{ fill: "var(--text-muted)", fontSize: 11 }} width={90} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-overlay)",
                border: "1px solid #333",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "var(--text-primary)" }}
              formatter={((value: number, name: string) => [
                t("dataExplorer.ares.networkOverview.percent", { value: formatNumber(value) }),
                name === "actual"
                  ? t("dataExplorer.ares.dqHistory.sla.actual")
                  : t("dataExplorer.ares.dqHistory.sla.target"),
              ]) as never}
            />
            <Bar dataKey="actual" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.compliant ? "var(--success)" : "var(--primary)"}
                />
              ))}
            </Bar>
            {chartData.length > 0 && (
              <ReferenceLine
                x={chartData[0].target}
                stroke="var(--accent)"
                strokeDasharray="3 3"
                label={{ value: t("dataExplorer.ares.dqHistory.sla.target"), fill: "var(--accent)", fontSize: 10 }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Error budget sparkline table */}
      <div className="mt-4">
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
          {t("dataExplorer.ares.dqHistory.sla.errorBudget")}
        </h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {compliance.map((c) => (
            <div
              key={c.category}
              className={`rounded border px-3 py-2 ${
                c.compliant
                  ? "border-success/30 bg-success/5"
                  : "border-primary/30 bg-primary/5"
              }`}
            >
              <p className="text-xs capitalize text-text-muted">{c.category.replace(/_/g, " ")}</p>
              <p className={`text-sm font-semibold ${c.compliant ? "text-success" : "text-critical"}`}>
                {c.error_budget_remaining >= 0 ? "+" : ""}
                {t("dataExplorer.ares.networkOverview.percent", {
                  value: formatNumber(c.error_budget_remaining, { maximumFractionDigits: 1 }),
                })}
              </p>
              <p className="text-[10px] text-text-ghost">
                {t("dataExplorer.ares.dqHistory.sla.targetComparison", {
                  actual: formatNumber(c.actual, { maximumFractionDigits: 1 }),
                  target: formatNumber(c.target),
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DqSlaDashboard({ sourceId }: DqSlaDashboardProps) {
  const { data: slaTargets } = useDqSlaTargets(sourceId);
  const { data: compliance } = useDqSlaCompliance(sourceId);
  const { user } = useAuthStore();

  const isAdmin = user?.roles?.some(
    (r: string) =>
      r === "admin" || r === "super-admin" || r === "data-steward",
  );

  return (
    <div>
      {isAdmin && (
        <SlaForm
          sourceId={sourceId}
          existingTargets={slaTargets ?? []}
        />
      )}

      <ComplianceChart compliance={compliance ?? []} />
    </div>
  );
}
