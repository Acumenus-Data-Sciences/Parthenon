import { useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  BarChart2,
  Handshake,
  Plus,
  Trash2,
  ChevronRight,
  Loader2,
  CheckCircle2,
  FileText,
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
  draft: "bg-[#232328] text-[#8A857D]",
  running: "bg-blue-400/15 text-blue-400",
  completed: "bg-[#2DD4BF]/15 text-[#2DD4BF]",
  failed: "bg-[#E85A6B]/15 text-[#E85A6B]",
};

const inputCls =
  "w-full rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40 transition-colors";
const selectCls =
  "w-full rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF] transition-colors";

function StatsBar() {
  const { data: stats, isLoading } = useHeorStats();

  const items = [
    { label: "Total Analyses", value: stats?.total_analyses ?? 0, icon: BarChart2, color: "#F59E0B" },
    { label: "Completed", value: stats?.completed_analyses ?? 0, icon: CheckCircle2, color: "#2DD4BF" },
    { label: "Value Contracts", value: stats?.total_contracts ?? 0, icon: Handshake, color: "#A78BFA" },
    {
      label: "Analysis Types",
      value: Object.keys(stats?.by_type ?? {}).length,
      icon: FileText,
      color: "#60A5FA",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#151518] px-4 py-3"
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0"
            style={{ backgroundColor: `${item.color}18` }}
          >
            <item.icon size={16} style={{ color: item.color }} />
          </div>
          <div>
            <p
              className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
              style={{ color: item.color }}
            >
              {isLoading ? "—" : item.value}
            </p>
            <p className="text-[10px] text-[#5A5650] uppercase tracking-wider">{item.label}</p>
          </div>
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
    await createMutation.mutateAsync({
      name,
      analysis_type: type as HeorAnalysis["analysis_type"],
      description: description || undefined,
    });
    setName("");
    setDescription("");
    onCreated();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-[#F0EDE8]">New Economic Analysis</h3>
      <div className="grid grid-cols-2 gap-3">
        <input
          className={inputCls}
          placeholder="Analysis name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select className={selectCls} value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(ANALYSIS_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <input
        className={inputCls}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCreated}
          className="px-4 py-2 text-sm text-[#5A5650] hover:text-[#8A857D] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8A857D]">
          Build cost-effectiveness, budget impact, and ROI analyses with scenario modeling and
          sensitivity analysis.
        </p>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
        >
          <Plus size={14} />
          New Analysis
        </button>
      </div>

      {showNew && <NewAnalysisForm onCreated={() => setShowNew(false)} />}

      {isLoading && (
        <div className="flex items-center gap-2 text-[#5A5650]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!isLoading && analyses.length === 0 && !showNew && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-10 text-center text-sm text-[#5A5650]">
          No analyses yet. Click "New Analysis" to get started.
        </div>
      )}

      <div className="space-y-2">
        {analyses.map((a) => (
          <div
            key={a.id}
            className="rounded-lg border border-[#232328] bg-[#151518] p-4 flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-[#F0EDE8] truncate">{a.name}</span>
                <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#232328] text-[#8A857D]">
                  {ANALYSIS_TYPE_LABELS[a.analysis_type] ?? a.analysis_type}
                </span>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    STATUS_BADGE[a.status] ?? "bg-[#232328] text-[#8A857D]"
                  }`}
                >
                  {a.status}
                </span>
              </div>
              {a.description && (
                <p className="text-sm text-[#8A857D] truncate">{a.description}</p>
              )}
              <p className="text-xs text-[#5A5650] mt-1">
                {a.scenarios?.length ?? 0} scenarios ·{" "}
                {a.time_horizon?.replace("_", " ")} · {a.currency}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                to={`/heor/${a.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A30] bg-[#151518] px-3 py-1.5 text-xs font-medium text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#3A3A42] transition-colors"
              >
                <ChevronRight size={12} />
                Open
              </Link>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(a.id)}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded text-[#5A5650] hover:text-[#E85A6B] hover:bg-[#E85A6B]/10 disabled:opacity-40 transition-colors"
                title="Delete analysis"
              >
                <Trash2 size={13} />
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
      analysis_id: 0,
    } as Parameters<typeof createMutation.mutateAsync>[0]);
    setShowNew(false);
    setContractName("");
    setDrugName("");
    setOutcomeMetric("");
    setListPrice("");
  };

  const contractStatusCls = (status: string) => {
    if (status === "active") return "bg-[#2DD4BF]/15 text-[#2DD4BF]";
    if (status === "expired") return "bg-[#E85A6B]/15 text-[#E85A6B]";
    return "bg-[#232328] text-[#8A857D]";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#8A857D]">
          Define outcomes-based value contracts with rebate tiers linked to observed outcome rates.
        </p>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors"
        >
          <Plus size={14} />
          New Contract
        </button>
      </div>

      {showNew && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-[#F0EDE8]">New Value Contract</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputCls}
              placeholder="Contract name *"
              value={contractName}
              onChange={(e) => setContractName(e.target.value)}
              required
            />
            <input
              className={inputCls}
              placeholder="Drug / intervention name"
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputCls}
              placeholder="Outcome metric (e.g. hba1c_reduction)"
              value={outcomeMetric}
              onChange={(e) => setOutcomeMetric(e.target.value)}
              required
            />
            <input
              className={inputCls}
              type="number"
              placeholder="List price (USD)"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-4 py-2 text-sm text-[#5A5650] hover:text-[#8A857D] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Create
            </button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-[#5A5650]">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      )}

      {!isLoading && !contracts?.length && !showNew && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-10 text-center text-sm text-[#5A5650]">
          No value contracts defined. Click "New Contract" to start.
        </div>
      )}

      <div className="space-y-2">
        {contracts?.map((c: HeorValueContract) => (
          <div
            key={c.id}
            className="rounded-lg border border-[#232328] bg-[#151518] p-4 flex items-start gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-[#F0EDE8]">{c.contract_name}</span>
                {c.drug_name && (
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#232328] text-[#8A857D]">
                    {c.drug_name}
                  </span>
                )}
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${contractStatusCls(c.status)}`}
                >
                  {c.status}
                </span>
              </div>
              <p className="text-sm text-[#8A857D]">
                Outcome:{" "}
                <span className="text-[#C5C0B8] font-medium">{c.outcome_metric}</span>
                {c.list_price && ` · List price: $${c.list_price.toLocaleString()}`}
                {c.baseline_rate !== null &&
                  ` · Baseline: ${(c.baseline_rate * 100).toFixed(1)}%`}
              </p>
              {c.rebate_tiers && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {c.rebate_tiers.map((tier, i) => (
                    <span
                      key={i}
                      className="text-xs bg-[#0E0E11] border border-[#232328] rounded px-2 py-0.5 text-[#5A5650]"
                    >
                      ≥{(tier.threshold * 100).toFixed(0)}% improvement →{" "}
                      {tier.rebate_percent}% rebate
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(c.id)}
              disabled={deleteMutation.isPending}
              className="p-1.5 rounded text-[#5A5650] hover:text-[#E85A6B] hover:bg-[#E85A6B]/10 disabled:opacity-40 transition-colors flex-shrink-0"
              title="Delete contract"
            >
              <Trash2 size={13} />
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0"
          style={{ backgroundColor: "#F59E0B18" }}
        >
          <TrendingUp size={18} style={{ color: "#F59E0B" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Health Economics & Outcomes Research
          </h1>
          <p className="text-sm text-[#8A857D]">
            Cost-effectiveness analyses, budget impact modeling, ROI calculators, and value-based
            contract simulation
          </p>
        </div>
      </div>

      <StatsBar />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#232328]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? "border-[#2DD4BF] text-[#2DD4BF]"
                : "border-transparent text-[#5A5650] hover:text-[#8A857D]"
            }`}
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
