import { useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  BarChart2,
  FileText,
  Handshake,
  Plus,
  Trash2,
  Play,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import {
  useHeorStats,
  useHeorAnalyses,
  useCreateHeorAnalysis,
  useDeleteHeorAnalysis,
  useHeorContracts,
  useCreateContract,
  useDeleteContract,
} from "../hooks/useHeor";
import type { HeorAnalysis, HeorValueContract } from "../types";

const TABS = [
  { id: "analyses", label: "Economic Analyses", icon: BarChart2 },
  { id: "contracts", label: "Value Contracts", icon: Handshake },
] as const;
type Tab = (typeof TABS)[number]["id"];

const ANALYSIS_TYPE_LABELS: Record<string, string> = {
  cea: "Cost-Effectiveness",
  cba: "Cost-Benefit",
  cua: "Cost-Utility",
  budget_impact: "Budget Impact",
  roi: "ROI Analysis",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-neutral",
  running: "badge-warning",
  completed: "badge-success",
  failed: "badge-danger",
};

function StatsBar() {
  const { data: stats, isLoading } = useHeorStats();
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {[
        { label: "Total Analyses", value: stats?.total_analyses ?? 0 },
        { label: "Completed", value: stats?.completed_analyses ?? 0 },
        { label: "Value Contracts", value: stats?.total_contracts ?? 0 },
        {
          label: "Analysis Types",
          value: Object.keys(stats?.by_type ?? {}).length,
        },
      ].map((item) => (
        <div key={item.label} className="card p-4">
          <p className="text-sm text-muted mb-1">{item.label}</p>
          <p className="text-2xl font-bold">
            {isLoading ? "—" : item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function NewAnalysisForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("cea");
  const [description, setDescription] = useState("");
  const createMutation = useCreateHeorAnalysis();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createMutation.mutateAsync({ name, analysis_type: type as HeorAnalysis["analysis_type"], description: description || undefined });
    setName("");
    setDescription("");
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 mb-4 space-y-3">
      <h3 className="font-semibold text-sm">New Economic Analysis</h3>
      <div className="grid grid-cols-2 gap-3">
        <input
          className="input"
          placeholder="Analysis name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(ANALYSIS_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <input
        className="input"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCreated}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
          Create
        </button>
      </div>
    </form>
  );
}

function AnalysesTab() {
  const { data, isLoading } = useHeorAnalyses();
  const deleteMutation = useDeleteHeorAnalysis();
  const [showNew, setShowNew] = useState(false);

  const analyses: HeorAnalysis[] = (data as { data?: HeorAnalysis[] })?.data ?? [];

  return (
    <div>
      <div className="flex justify-between mb-4">
        <p className="text-sm text-muted">
          Build cost-effectiveness, budget impact, and ROI analyses with scenario modeling and sensitivity analysis.
        </p>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New Analysis
        </button>
      </div>

      {showNew && <NewAnalysisForm onCreated={() => setShowNew(false)} />}

      {isLoading && <div className="text-muted text-sm">Loading…</div>}

      {!isLoading && analyses.length === 0 && !showNew && (
        <div className="card p-8 text-center text-muted">
          No analyses yet. Click "New Analysis" to get started.
        </div>
      )}

      <div className="space-y-2">
        {analyses.map((a) => (
          <div key={a.id} className="card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium truncate">{a.name}</span>
                <span className="badge badge-sm badge-neutral">
                  {ANALYSIS_TYPE_LABELS[a.analysis_type] ?? a.analysis_type}
                </span>
                <span className={`badge badge-sm ${STATUS_BADGE[a.status] ?? "badge-neutral"}`}>
                  {a.status}
                </span>
              </div>
              {a.description && (
                <p className="text-sm text-muted truncate">{a.description}</p>
              )}
              <p className="text-xs text-muted mt-1">
                {a.scenarios?.length ?? 0} scenarios · {a.time_horizon?.replace("_", " ")} · {a.currency}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/heor/${a.id}`}
                className="btn btn-secondary btn-sm"
              >
                <ChevronRight size={12} /> Open
              </Link>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => deleteMutation.mutate(a.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractsTab() {
  const { data: contracts, isLoading } = useHeorContracts();
  const deleteMutation = useDeleteContract();
  const [showNew, setShowNew] = useState(false);
  const [contractName, setContractName] = useState("");
  const [drugName, setDrugName] = useState("");
  const [outcomeMetric, setOutcomeMetric] = useState("");
  const [listPrice, setListPrice] = useState("");
  const createMutation = useCreateContract();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      contract_name: contractName,
      drug_name: drugName || undefined,
      outcome_metric: outcomeMetric,
      list_price: listPrice ? parseFloat(listPrice) : undefined,
      rebate_tiers: [
        { threshold: 0.1, rebate_percent: 5 },
        { threshold: 0.2, rebate_percent: 10 },
        { threshold: 0.3, rebate_percent: 20 },
      ],
      analysis_id: 0, // placeholder - user can edit
    } as Parameters<typeof createMutation.mutateAsync>[0]);
    setShowNew(false);
    setContractName("");
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        <p className="text-sm text-muted">
          Define outcomes-based value contracts with rebate tiers linked to observed outcome rates.
        </p>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New Contract
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="card p-4 mb-4 space-y-3">
          <h3 className="font-semibold text-sm">New Value Contract</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Contract name *" value={contractName} onChange={(e) => setContractName(e.target.value)} required />
            <input className="input" placeholder="Drug / intervention name" value={drugName} onChange={(e) => setDrugName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Outcome metric (e.g. hba1c_reduction)" value={outcomeMetric} onChange={(e) => setOutcomeMetric(e.target.value)} required />
            <input className="input" type="number" placeholder="List price (USD)" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>Create</button>
          </div>
        </form>
      )}

      {isLoading && <div className="text-muted text-sm">Loading…</div>}

      {!isLoading && !contracts?.length && !showNew && (
        <div className="card p-8 text-center text-muted">
          No value contracts defined. Click "New Contract" to start.
        </div>
      )}

      <div className="space-y-2">
        {contracts?.map((c: HeorValueContract) => (
          <div key={c.id} className="card p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{c.contract_name}</span>
                {c.drug_name && (
                  <span className="badge badge-sm badge-neutral">{c.drug_name}</span>
                )}
                <span className={`badge badge-sm ${c.status === "active" ? "badge-success" : c.status === "expired" ? "badge-danger" : "badge-neutral"}`}>
                  {c.status}
                </span>
              </div>
              <p className="text-sm text-muted">
                Outcome: <strong>{c.outcome_metric}</strong>
                {c.list_price && ` · List price: $${c.list_price.toLocaleString()}`}
                {c.baseline_rate !== null && ` · Baseline: ${(c.baseline_rate * 100).toFixed(1)}%`}
              </p>
              {c.rebate_tiers && (
                <div className="flex gap-2 mt-1 flex-wrap">
                  {c.rebate_tiers.map((tier, i) => (
                    <span key={i} className="text-xs bg-surface rounded px-2 py-0.5 text-muted">
                      ≥{(tier.threshold * 100).toFixed(0)}% improvement → {tier.rebate_percent}% rebate
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => deleteMutation.mutate(c.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HeorPage() {
  const [tab, setTab] = useState<Tab>("analyses");

  return (
    <div className="page-container">
      <div className="page-header mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp size={24} className="text-accent" />
          <div>
            <h1 className="page-title">Health Economics & Outcomes Research</h1>
            <p className="page-subtitle">
              Cost-effectiveness analyses, budget impact modeling, ROI calculators, and value-based contract simulation
            </p>
          </div>
        </div>
      </div>

      <StatsBar />

      <div className="tabs mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`tab ${tab === id ? "tab-active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "analyses" && <AnalysesTab />}
      {tab === "contracts" && <ContractsTab />}
    </div>
  );
}
