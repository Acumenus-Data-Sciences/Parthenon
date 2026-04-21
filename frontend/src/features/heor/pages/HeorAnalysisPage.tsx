import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Play,
  Plus,
  Trash2,
  BarChart2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import {
  useHeorAnalysis,
  useRunAnalysis,
  useHeorResults,
  useCreateScenario,
  useDeleteScenario,
  useCreateParameter,
  useDeleteParameter,
} from "../hooks/useHeor";
import type { HeorResult, HeorCostParameter, TornadoEntry } from "../types";
import {
  getHeorAnalysisTypeLabel,
  getHeorParameterTypeLabel,
  getHeorPerspectiveLabel,
  getHeorScenarioTypeLabel,
  getHeorTimeHorizonLabel,
} from "../lib/i18n";
import CostEffectivenessPlane from "../components/CostEffectivenessPlane";
import TornadoDiagram from "../components/TornadoDiagram";
import BudgetImpactChart from "../components/BudgetImpactChart";
import ScenarioComparisonChart from "../components/ScenarioComparisonChart";

const inputCls =
  "w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40 transition-colors";
const selectCls =
  "w-full rounded-lg bg-surface-base border border-border-default px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success transition-colors";

function fmt(v: number | null | undefined, prefix = "", decimals = 0): string {
  if (v === null || v === undefined) return "—";
  return prefix + v.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function ResultCard({ result }: { result: HeorResult }) {
  const { t } = useTranslation("app");

  const resultItems = [
    { label: t("heor.common.labels.totalCost"), value: fmt(result.total_cost, "$") },
    { label: t("heor.common.labels.totalQalys"), value: fmt(result.total_qalys, "", 3) },
    { label: t("heor.common.labels.incrementalCost"), value: fmt(result.incremental_cost, "$") },
    { label: t("heor.common.labels.incrementalQalys"), value: fmt(result.incremental_qalys, "", 3) },
    { label: t("heor.common.labels.icerPerQaly"), value: fmt(result.icer, "$") },
    {
      label: t("heor.common.labels.netMonetaryBenefit"),
      value: fmt(result.net_monetary_benefit, "$"),
    },
    {
      label: t("heor.common.labels.roi"),
      value: result.roi_percent !== null ? `${result.roi_percent.toFixed(1)}%` : "—",
    },
    {
      label: t("heor.common.labels.paybackMonths"),
      value: fmt(result.payback_period_months, "", 1),
    },
  ];

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-4">
        {result.scenario?.name ??
          t("heor.analysis.scenarioFallback", { id: result.scenario_id })}
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {resultItems.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-text-ghost mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      {result.budget_impact_year1 !== null && (
        <div>
          <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-2">
            {t("heor.common.labels.budgetImpact")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { year: t("heor.common.values.year1"), val: result.budget_impact_year1 },
              { year: t("heor.common.values.year3"), val: result.budget_impact_year3 },
              { year: t("heor.common.values.year5"), val: result.budget_impact_year5 },
            ].map(({ year, val }) => (
              <div
                key={year}
                className="rounded-lg bg-surface-base border border-border-default p-2 text-center"
              >
                <p className="text-[10px] text-text-ghost">{year}</p>
                <p className="text-sm font-semibold font-['IBM_Plex_Mono',monospace] text-warning mt-0.5">
                  {fmt(val, "$")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.tornado_data && result.tornado_data.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-2">
            {t("heor.charts.tornado.topFive")}
          </p>
          <div className="space-y-1.5">
            {result.tornado_data.slice(0, 5).map((entry: TornadoEntry, index) => {
              const maxRange = result.tornado_data![0]?.range ?? 1;
              const pct = maxRange > 0 ? (entry.range / maxRange) * 100 : 0;
              return (
                <div key={index}>
                  <div className="flex justify-between text-xs text-text-ghost mb-0.5">
                    <span className="truncate max-w-[60%] text-text-muted">{entry.parameter}</span>
                    <span>±${entry.range.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-surface-base rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: "var(--success)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HeorAnalysisPage() {
  const { t } = useTranslation("app");
  const { id } = useParams<{ id: string }>();
  const analysisId = parseInt(id ?? "0");

  const { data: analysis, isLoading } = useHeorAnalysis(analysisId);
  const { data: results } = useHeorResults(analysisId);
  const runMutation = useRunAnalysis(analysisId);
  const createScenario = useCreateScenario(analysisId);
  const deleteScenario = useDeleteScenario(analysisId);
  const createParam = useCreateParameter(analysisId);
  const deleteParam = useDeleteParameter(analysisId);

  const [newScenarioName, setNewScenarioName] = useState("");
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [showParamForm, setShowParamForm] = useState(false);
  const [paramForm, setParamForm] = useState({
    parameter_name: "",
    parameter_type: "drug_cost",
    value: "",
    unit: "",
    lower_bound: "",
    upper_bound: "",
  });

  const parameterTypeOptions = [
    "drug_cost",
    "admin_cost",
    "hospitalization",
    "er_visit",
    "qaly_weight",
    "utility_value",
    "resource_use",
    "avoided_cost",
    "program_cost",
  ] as const;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-success" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted">
        {t("heor.common.messages.analysisNotFound")}
      </div>
    );
  }

  const handleAddScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;
    await createScenario.mutateAsync({
      name: newScenarioName,
      is_base_case: (analysis.scenarios?.length ?? 0) === 0,
    });
    setNewScenarioName("");
    setShowScenarioForm(false);
  };

  const handleAddParam = async (e: React.FormEvent) => {
    e.preventDefault();
    await createParam.mutateAsync({
      parameter_name: paramForm.parameter_name,
      parameter_type: paramForm.parameter_type as HeorCostParameter["parameter_type"],
      value: parseFloat(paramForm.value),
      unit: paramForm.unit || undefined,
      lower_bound: paramForm.lower_bound ? parseFloat(paramForm.lower_bound) : undefined,
      upper_bound: paramForm.upper_bound ? parseFloat(paramForm.upper_bound) : undefined,
    });
    setParamForm({
      parameter_name: "",
      parameter_type: "drug_cost",
      value: "",
      unit: "",
      lower_bound: "",
      upper_bound: "",
    });
    setShowParamForm(false);
  };

  return (
    <div className="space-y-6">
      <Link
        to="/heor"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        {t("heor.common.actions.backToHeor")}
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{analysis.name}</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {t("heor.analysis.headerMeta", {
              analysisType: getHeorAnalysisTypeLabel(t, analysis.analysis_type),
              perspective: getHeorPerspectiveLabel(t, analysis.perspective),
              timeHorizon: getHeorTimeHorizonLabel(t, analysis.time_horizon),
              discount: (analysis.discount_rate * 100).toFixed(0),
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending || analysis.status === "running"}
          className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark disabled:opacity-50 transition-colors"
        >
          {runMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          {runMutation.isPending
            ? t("heor.common.messages.running")
            : t("heor.common.actions.runAnalysis")}
        </button>
      </div>

      {runMutation.isSuccess && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {t("heor.common.messages.computedScenarios", {
            count: (runMutation.data as { scenarios_computed: number }).scenarios_computed,
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <BarChart2 size={14} className="text-warning" />
              {t("heor.common.labels.scenarios")} ({analysis.scenarios?.length ?? 0})
            </h2>
            <button
              type="button"
              onClick={() => setShowScenarioForm(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
            >
              <Plus size={11} />
              {t("heor.common.actions.add")}
            </button>
          </div>

          {showScenarioForm && (
            <form
              onSubmit={handleAddScenario}
              className="rounded-lg border border-border-default bg-surface-raised p-3 flex gap-2"
            >
              <input
                className={inputCls + " flex-1"}
                placeholder={t("heor.common.placeholders.scenarioName")}
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                required
              />
              <button
                type="submit"
                className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-surface-base hover:bg-success-dark transition-colors"
              >
                {t("heor.common.actions.add")}
              </button>
              <button
                type="button"
                onClick={() => setShowScenarioForm(false)}
                className="rounded-lg border border-border-default px-2.5 py-1.5 text-xs text-text-ghost hover:text-text-muted transition-colors"
              >
                <X size={12} />
              </button>
            </form>
          )}

          <div className="space-y-1.5">
            {analysis.scenarios?.map((scenario) => (
              <div
                key={scenario.id}
                className="rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 flex items-center gap-2"
              >
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {scenario.name}
                  </span>
                  {scenario.is_base_case && (
                    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-success/15 text-success flex-shrink-0">
                      {t("heor.common.values.baseCase")}
                    </span>
                  )}
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-surface-elevated text-text-muted flex-shrink-0">
                    {getHeorScenarioTypeLabel(t, scenario.scenario_type)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteScenario.mutate(scenario.id)}
                  className="p-1 rounded text-text-ghost hover:text-critical hover:bg-critical/10 transition-colors flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {!analysis.scenarios?.length && (
              <p className="text-sm text-text-ghost">
                {t("heor.common.messages.noScenariosYet")}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <DollarSign size={14} className="text-warning" />
              {t("heor.common.labels.costParameters")} ({analysis.parameters?.length ?? 0})
            </h2>
            <button
              type="button"
              onClick={() => setShowParamForm(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text-secondary hover:border-surface-highlight transition-colors"
            >
              <Plus size={11} />
              {t("heor.common.actions.add")}
            </button>
          </div>

          {showParamForm && (
            <form
              onSubmit={handleAddParam}
              className="rounded-lg border border-border-default bg-surface-raised p-3 space-y-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  placeholder={t("heor.common.placeholders.parameterName")}
                  value={paramForm.parameter_name}
                  onChange={(e) => setParamForm((prev) => ({ ...prev, parameter_name: e.target.value }))}
                  required
                />
                <select
                  className={selectCls}
                  value={paramForm.parameter_type}
                  onChange={(e) => setParamForm((prev) => ({ ...prev, parameter_type: e.target.value }))}
                >
                  {parameterTypeOptions.map((value) => (
                    <option key={value} value={value}>
                      {getHeorParameterTypeLabel(t, value)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  className={inputCls}
                  type="number"
                  placeholder={t("heor.common.placeholders.value")}
                  value={paramForm.value}
                  onChange={(e) => setParamForm((prev) => ({ ...prev, value: e.target.value }))}
                  required
                />
                <input
                  className={inputCls}
                  placeholder={t("heor.common.placeholders.unit")}
                  value={paramForm.unit}
                  onChange={(e) => setParamForm((prev) => ({ ...prev, unit: e.target.value }))}
                />
                <input
                  className={inputCls}
                  type="number"
                  placeholder={t("heor.common.placeholders.lowerBound")}
                  value={paramForm.lower_bound}
                  onChange={(e) => setParamForm((prev) => ({ ...prev, lower_bound: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowParamForm(false)}
                  className="px-3 py-1.5 text-xs text-text-ghost hover:text-text-muted transition-colors"
                >
                  {t("heor.common.actions.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={createParam.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-surface-base hover:bg-success-dark disabled:opacity-50 transition-colors"
                >
                  {createParam.isPending && <Loader2 size={11} className="animate-spin" />}
                  {t("heor.common.actions.add")}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-0 max-h-64 overflow-y-auto rounded-lg border border-border-default bg-surface-raised divide-y divide-border-subtle">
            {analysis.parameters?.map((parameter) => (
              <div
                key={parameter.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-overlay transition-colors"
              >
                <span className="flex-1 truncate text-text-secondary">{parameter.parameter_name}</span>
                <span className="text-text-ghost text-xs flex-shrink-0">
                  {getHeorParameterTypeLabel(t, parameter.parameter_type)}
                </span>
                <span className="font-mono font-semibold text-xs text-warning flex-shrink-0">
                  {parameter.value.toLocaleString()} {parameter.unit ?? ""}
                </span>
                <button
                  type="button"
                  onClick={() => deleteParam.mutate(parameter.id)}
                  className="p-0.5 rounded text-text-ghost hover:text-critical hover:bg-critical/10 transition-colors flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {!analysis.parameters?.length && (
              <p className="text-sm text-text-ghost px-3 py-3">
                {t("heor.common.messages.noParametersYet")}
              </p>
            )}
          </div>
        </div>
      </div>

      {results && results.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp size={14} className="text-warning" />
            {t("heor.analysis.resultsTitle")}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <CostEffectivenessPlane
              results={results}
              wtp={results[0]?.willingness_to_pay_threshold ?? 50000}
            />
            <TornadoDiagram
              tornadoData={
                results.find((result) => result.tornado_data?.some((entry) => entry.range > 0))
                  ?.tornado_data ?? []
              }
              baseIcer={results.find((result) => result.icer !== null)?.icer}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <BudgetImpactChart results={results} />
            <ScenarioComparisonChart results={results} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
        </div>
      )}

      {analysis.status === "completed" && (!results || results.length === 0) && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 flex items-center gap-2 text-sm text-amber-400">
          <AlertTriangle size={14} />
          {t("heor.common.messages.analysisCompletedNoResults")}
        </div>
      )}
    </div>
  );
}
