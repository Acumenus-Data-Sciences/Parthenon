import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  Play,
  Plus,
  Trash2,
  BarChart2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
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

function fmt(v: number | null | undefined, prefix = "", decimals = 0): string {
  if (v === null || v === undefined) return "—";
  return prefix + v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function ResultCard({ result }: { result: HeorResult }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3">{result.scenario?.name ?? `Scenario ${result.scenario_id}`}</h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: "Total Cost", value: fmt(result.total_cost, "$") },
          { label: "Total QALYs", value: fmt(result.total_qalys, "", 3) },
          { label: "Incremental Cost", value: fmt(result.incremental_cost, "$") },
          { label: "Incremental QALYs", value: fmt(result.incremental_qalys, "", 3) },
          { label: "ICER ($/QALY)", value: fmt(result.icer, "$") },
          { label: "Net Monetary Benefit", value: fmt(result.net_monetary_benefit, "$") },
          { label: "ROI", value: result.roi_percent !== null ? `${result.roi_percent.toFixed(1)}%` : "—" },
          { label: "Payback (months)", value: fmt(result.payback_period_months, "", 1) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-muted">{label}</p>
            <p className="font-semibold text-sm">{value}</p>
          </div>
        ))}
      </div>

      {result.budget_impact_year1 !== null && (
        <div>
          <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">Budget Impact</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { year: "Year 1", val: result.budget_impact_year1 },
              { year: "Year 3", val: result.budget_impact_year3 },
              { year: "Year 5", val: result.budget_impact_year5 },
            ].map(({ year, val }) => (
              <div key={year} className="bg-surface rounded-lg p-2 text-center">
                <p className="text-xs text-muted">{year}</p>
                <p className="font-bold text-sm">{fmt(val, "$")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.tornado_data && result.tornado_data.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">Sensitivity (Tornado — top 5)</p>
          <div className="space-y-1">
            {result.tornado_data.slice(0, 5).map((t: TornadoEntry, i) => {
              const maxRange = result.tornado_data![0]?.range ?? 1;
              const pct = maxRange > 0 ? (t.range / maxRange) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs text-muted mb-0.5">
                    <span className="truncate max-w-[60%]">{t.parameter}</span>
                    <span>±${t.range.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${pct}%` }}
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
    return <div className="page-container text-muted">Loading…</div>;
  }
  if (!analysis) {
    return <div className="page-container text-muted">Analysis not found.</div>;
  }

  const handleRun = () => runMutation.mutate();

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
    setParamForm({ parameter_name: "", parameter_type: "drug_cost", value: "", unit: "", lower_bound: "", upper_bound: "" });
    setShowParamForm(false);
  };

  return (
    <div className="page-container">
      <Link to="/heor" className="flex items-center gap-1 text-sm text-muted mb-4 hover:text-foreground">
        <ChevronLeft size={14} /> Back to HEOR
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">{analysis.name}</h1>
          <p className="text-muted text-sm">
            {analysis.analysis_type?.toUpperCase()} · {analysis.perspective} · {analysis.time_horizon?.replace("_", " ")} · {(analysis.discount_rate * 100).toFixed(0)}% discount
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleRun}
          disabled={runMutation.isPending || analysis.status === "running"}
        >
          <Play size={14} className={runMutation.isPending ? "animate-pulse" : ""} />
          {runMutation.isPending ? "Running…" : "Run Analysis"}
        </button>
      </div>

      {runMutation.isSuccess && (
        <div className="alert alert-success mb-4 text-sm">
          Computed {(runMutation.data as { scenarios_computed: number }).scenarios_computed} scenarios.
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Scenarios */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <BarChart2 size={14} className="text-accent" />
              Scenarios ({analysis.scenarios?.length ?? 0})
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowScenarioForm(true)}>
              <Plus size={12} /> Add
            </button>
          </div>

          {showScenarioForm && (
            <form onSubmit={handleAddScenario} className="card p-3 mb-3 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Scenario name"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm">Add</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowScenarioForm(false)}>✕</button>
            </form>
          )}

          <div className="space-y-2">
            {analysis.scenarios?.map((s) => (
              <div key={s.id} className="card p-3 flex items-center gap-2">
                <div className="flex-1">
                  <span className="font-medium text-sm">{s.name}</span>
                  {s.is_base_case && (
                    <span className="ml-2 badge badge-sm badge-success">Base Case</span>
                  )}
                  <span className="ml-2 badge badge-sm badge-neutral">{s.scenario_type}</span>
                </div>
                <button
                  className="text-gray-500 hover:text-red-400"
                  onClick={() => deleteScenario.mutate(s.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {!analysis.scenarios?.length && (
              <p className="text-sm text-muted">No scenarios yet. Add at least one to run the analysis.</p>
            )}
          </div>
        </div>

        {/* Parameters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <DollarSign size={14} className="text-accent" />
              Cost Parameters ({analysis.parameters?.length ?? 0})
            </h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowParamForm(true)}>
              <Plus size={12} /> Add
            </button>
          </div>

          {showParamForm && (
            <form onSubmit={handleAddParam} className="card p-3 mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className="input" placeholder="Parameter name *" value={paramForm.parameter_name} onChange={(e) => setParamForm(p => ({ ...p, parameter_name: e.target.value }))} required />
                <select className="input" value={paramForm.parameter_type} onChange={(e) => setParamForm(p => ({ ...p, parameter_type: e.target.value }))}>
                  {Object.entries(PARAM_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input className="input" type="number" placeholder="Value *" value={paramForm.value} onChange={(e) => setParamForm(p => ({ ...p, value: e.target.value }))} required />
                <input className="input" placeholder="Unit" value={paramForm.unit} onChange={(e) => setParamForm(p => ({ ...p, unit: e.target.value }))} />
                <input className="input" type="number" placeholder="Lower bound" value={paramForm.lower_bound} onChange={(e) => setParamForm(p => ({ ...p, lower_bound: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowParamForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={createParam.isPending}>Add</button>
              </div>
            </form>
          )}

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {analysis.parameters?.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm py-1 border-b border-subtle">
                <span className="flex-1 truncate">{p.parameter_name}</span>
                <span className="text-muted text-xs">{PARAM_TYPE_LABELS[p.parameter_type] ?? p.parameter_type}</span>
                <span className="font-mono font-semibold">{p.value.toLocaleString()} {p.unit ?? ""}</span>
                <button className="text-gray-500 hover:text-red-400" onClick={() => deleteParam.mutate(p.id)}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {!analysis.parameters?.length && (
              <p className="text-sm text-muted">No parameters yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {results && results.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-accent" /> Results
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {results.map((r: HeorResult) => (
              <ResultCard key={r.id} result={r} />
            ))}
          </div>
        </div>
      )}

      {analysis.status === "completed" && (!results || results.length === 0) && (
        <div className="alert mt-4 flex items-center gap-2 text-sm">
          <AlertTriangle size={14} /> Analysis completed but no results found. Try re-running.
        </div>
      )}
    </div>
  );
}
