import { useState } from "react";
import { useParams, Link } from "react-router-dom";
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
import CostEffectivenessPlane from "../components/CostEffectivenessPlane";
import TornadoDiagram from "../components/TornadoDiagram";
import BudgetImpactChart from "../components/BudgetImpactChart";
import ScenarioComparisonChart from "../components/ScenarioComparisonChart";

const PARAM_TYPE_LABELS: Record<string, string> = {
  drug_cost: "Drug Cost",
  admin_cost: "Admin Cost",
  hospitalization: "Hospitalization",
  er_visit: "ER Visit",
  qaly_weight: "QALY Weight",
  utility_value: "Utility Value",
  resource_use: "Resource Use",
  avoided_cost: "Avoided Cost",
  program_cost: "Program Cost",
};

const inputCls =
  "w-full rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors";
const selectCls =
  "w-full rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF] transition-colors";

function fmt(v: number | null | undefined, prefix = "", decimals = 0): string {
  if (v === null || v === undefined) return "—";
  return prefix + v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function ResultCard({ result }: { result: HeorResult }) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
        {result.scenario?.name ?? `Scenario ${result.scenario_id}`}
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Total Cost", value: fmt(result.total_cost, "$") },
          { label: "Total QALYs", value: fmt(result.total_qalys, "", 3) },
          { label: "Incremental Cost", value: fmt(result.incremental_cost, "$") },
          { label: "Incremental QALYs", value: fmt(result.incremental_qalys, "", 3) },
          { label: "ICER ($/QALY)", value: fmt(result.icer, "$") },
          { label: "Net Monetary Benefit", value: fmt(result.net_monetary_benefit, "$") },
          {
            label: "ROI",
            value: result.roi_percent !== null ? `${result.roi_percent.toFixed(1)}%` : "—",
          },
          { label: "Payback (months)", value: fmt(result.payback_period_months, "", 1) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-[#5A5650] mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-[#F0EDE8]">{value}</p>
          </div>
        ))}
      </div>

      {result.budget_impact_year1 !== null && (
        <div>
          <p className="text-[10px] text-[#5A5650] uppercase tracking-wider font-medium mb-2">
            Budget Impact
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { year: "Year 1", val: result.budget_impact_year1 },
              { year: "Year 3", val: result.budget_impact_year3 },
              { year: "Year 5", val: result.budget_impact_year5 },
            ].map(({ year, val }) => (
              <div
                key={year}
                className="rounded-lg bg-[#0E0E11] border border-[#232328] p-2 text-center"
              >
                <p className="text-[10px] text-[#5A5650]">{year}</p>
                <p className="text-sm font-semibold font-['IBM_Plex_Mono',monospace] text-[#F59E0B] mt-0.5">
                  {fmt(val, "$")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.tornado_data && result.tornado_data.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-[#5A5650] uppercase tracking-wider font-medium mb-2">
            Sensitivity (Tornado — top 5)
          </p>
          <div className="space-y-1.5">
            {result.tornado_data.slice(0, 5).map((t: TornadoEntry, i) => {
              const maxRange = result.tornado_data![0]?.range ?? 1;
              const pct = maxRange > 0 ? (t.range / maxRange) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs text-[#5A5650] mb-0.5">
                    <span className="truncate max-w-[60%] text-[#8A857D]">{t.parameter}</span>
                    <span>±${t.range.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-[#0E0E11] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: "#2DD4BF" }}
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-[#2DD4BF]" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center py-24 text-[#8A857D]">
        Analysis not found.
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
      {/* Back nav */}
      <Link
        to="/heor"
        className="inline-flex items-center gap-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to HEOR
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F0EDE8]">{analysis.name}</h1>
          <p className="text-sm text-[#8A857D] mt-0.5">
            {analysis.analysis_type?.toUpperCase()} · {analysis.perspective} ·{" "}
            {analysis.time_horizon?.replace("_", " ")} ·{" "}
            {(analysis.discount_rate * 100).toFixed(0)}% discount
          </p>
        </div>
        <button
          type="button"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending || analysis.status === "running"}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50 transition-colors"
        >
          {runMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          {runMutation.isPending ? "Running…" : "Run Analysis"}
        </button>
      </div>

      {runMutation.isSuccess && (
        <div className="rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-4 py-3 text-sm text-[#2DD4BF]">
          Computed {(runMutation.data as { scenarios_computed: number }).scenarios_computed} scenarios.
        </div>
      )}

      {/* Scenarios + Parameters */}
      <div className="grid grid-cols-2 gap-6">
        {/* Scenarios */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-2">
              <BarChart2 size={14} className="text-[#F59E0B]" />
              Scenarios ({analysis.scenarios?.length ?? 0})
            </h2>
            <button
              type="button"
              onClick={() => setShowScenarioForm(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A30] bg-[#151518] px-2.5 py-1.5 text-xs font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
            >
              <Plus size={11} />
              Add
            </button>
          </div>

          {showScenarioForm && (
            <form
              onSubmit={handleAddScenario}
              className="rounded-lg border border-[#232328] bg-[#151518] p-3 flex gap-2"
            >
              <input
                className={inputCls + " flex-1"}
                placeholder="Scenario name"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                required
              />
              <button
                type="submit"
                className="rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-xs font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowScenarioForm(false)}
                className="rounded-lg border border-[#232328] px-2.5 py-1.5 text-xs text-[#5A5650] hover:text-[#8A857D] transition-colors"
              >
                ✕
              </button>
            </form>
          )}

          <div className="space-y-1.5">
            {analysis.scenarios?.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-[#232328] bg-[#151518] px-3 py-2.5 flex items-center gap-2"
              >
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-[#F0EDE8] truncate">{s.name}</span>
                  {s.is_base_case && (
                    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#2DD4BF]/15 text-[#2DD4BF] flex-shrink-0">
                      Base Case
                    </span>
                  )}
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#232328] text-[#8A857D] flex-shrink-0">
                    {s.scenario_type}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteScenario.mutate(s.id)}
                  className="p-1 rounded text-[#5A5650] hover:text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {!analysis.scenarios?.length && (
              <p className="text-sm text-[#5A5650]">
                No scenarios yet. Add at least one to run the analysis.
              </p>
            )}
          </div>
        </div>

        {/* Cost Parameters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-2">
              <DollarSign size={14} className="text-[#F59E0B]" />
              Cost Parameters ({analysis.parameters?.length ?? 0})
            </h2>
            <button
              type="button"
              onClick={() => setShowParamForm(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A30] bg-[#151518] px-2.5 py-1.5 text-xs font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
            >
              <Plus size={11} />
              Add
            </button>
          </div>

          {showParamForm && (
            <form
              onSubmit={handleAddParam}
              className="rounded-lg border border-[#232328] bg-[#151518] p-3 space-y-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  placeholder="Parameter name *"
                  value={paramForm.parameter_name}
                  onChange={(e) => setParamForm((p) => ({ ...p, parameter_name: e.target.value }))}
                  required
                />
                <select
                  className={selectCls}
                  value={paramForm.parameter_type}
                  onChange={(e) => setParamForm((p) => ({ ...p, parameter_type: e.target.value }))}
                >
                  {Object.entries(PARAM_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  className={inputCls}
                  type="number"
                  placeholder="Value *"
                  value={paramForm.value}
                  onChange={(e) => setParamForm((p) => ({ ...p, value: e.target.value }))}
                  required
                />
                <input
                  className={inputCls}
                  placeholder="Unit"
                  value={paramForm.unit}
                  onChange={(e) => setParamForm((p) => ({ ...p, unit: e.target.value }))}
                />
                <input
                  className={inputCls}
                  type="number"
                  placeholder="Lower bound"
                  value={paramForm.lower_bound}
                  onChange={(e) => setParamForm((p) => ({ ...p, lower_bound: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowParamForm(false)}
                  className="px-3 py-1.5 text-xs text-[#5A5650] hover:text-[#8A857D] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createParam.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-3 py-1.5 text-xs font-medium text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50 transition-colors"
                >
                  {createParam.isPending && <Loader2 size={11} className="animate-spin" />}
                  Add
                </button>
              </div>
            </form>
          )}

          <div className="space-y-0 max-h-64 overflow-y-auto rounded-lg border border-[#232328] bg-[#151518] divide-y divide-[#1E1E23]">
            {analysis.parameters?.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#1A1A1F] transition-colors"
              >
                <span className="flex-1 truncate text-[#C5C0B8]">{p.parameter_name}</span>
                <span className="text-[#5A5650] text-xs flex-shrink-0">
                  {PARAM_TYPE_LABELS[p.parameter_type] ?? p.parameter_type}
                </span>
                <span className="font-mono font-semibold text-xs text-[#F59E0B] flex-shrink-0">
                  {p.value.toLocaleString()} {p.unit ?? ""}
                </span>
                <button
                  type="button"
                  onClick={() => deleteParam.mutate(p.id)}
                  className="p-0.5 rounded text-[#5A5650] hover:text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {!analysis.parameters?.length && (
              <p className="text-sm text-[#5A5650] px-3 py-3">No parameters yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-[#F0EDE8] flex items-center gap-2">
            <TrendingUp size={14} className="text-[#F59E0B]" />
            Results
          </h2>

          {/* Visualization Charts */}
          <div className="grid grid-cols-2 gap-4">
            <CostEffectivenessPlane
              results={results}
              wtp={results[0]?.willingness_to_pay_threshold ?? 50000}
            />
            <TornadoDiagram
              tornadoData={
                results.find((r) => r.tornado_data && r.tornado_data.length > 0)?.tornado_data ?? []
              }
              baseIcer={results.find((r) => r.icer !== null)?.icer}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <BudgetImpactChart results={results} />
            <ScenarioComparisonChart results={results} />
          </div>

          {/* Per-Scenario Result Cards */}
          <div className="grid grid-cols-2 gap-4">
            {results.map((r: HeorResult) => (
              <ResultCard key={r.id} result={r} />
            ))}
          </div>
        </div>
      )}

      {analysis.status === "completed" && (!results || results.length === 0) && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 flex items-center gap-2 text-sm text-amber-400">
          <AlertTriangle size={14} />
          Analysis completed but no results found. Try re-running.
        </div>
      )}
    </div>
  );
}
