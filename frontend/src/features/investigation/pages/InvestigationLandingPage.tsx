import { Link, useNavigate } from "react-router-dom";
import {
  Dna,
  Microscope,
  Activity,
  FileText,
  ArrowLeft,
  Plus,
  ChevronRight,
} from "lucide-react";
import { useInvestigations } from "../hooks/useInvestigation";
import type { Investigation } from "../types";

// ── Sample investigation definitions (static, pre-seed the creation form) ──────

interface SampleInvestigation {
  title: string;
  question: string;
  badges: string[];
  domains: { phenotype: boolean; clinical: boolean; genomic: boolean; synthesis: boolean };
}

const SAMPLE_INVESTIGATIONS: SampleInvestigation[] = [
  {
    title: "SGLT2 Inhibitors and CKD Progression in T2DM",
    question:
      "Does SGLT2 inhibition reduce chronic kidney disease progression in patients with Type 2 Diabetes Mellitus?",
    badges: ["3 concept sets", "2 cohorts", "1 estimation", "5 GWAS loci"],
    domains: { phenotype: true, clinical: true, genomic: true, synthesis: false },
  },
  {
    title: "Statin Paradox — Simvastatin vs Atorvastatin Cardiovascular Outcomes",
    question:
      "Is there a clinically meaningful difference in cardiovascular outcomes between simvastatin and atorvastatin in statin-naive patients?",
    badges: ["2 concept sets", "2 cohorts", "1 characterization", "1 estimation"],
    domains: { phenotype: true, clinical: true, genomic: false, synthesis: false },
  },
  {
    title: "TCF7L2 and Pancreatic Beta Cell Dysfunction",
    question:
      "Does the TCF7L2 risk variant contribute to T2DM through pancreatic beta cell dysfunction, and what clinical evidence supports this mechanism?",
    badges: ["1 concept set", "1 cohort", "12 Open Targets associations", "3 GWAS loci"],
    domains: { phenotype: true, clinical: false, genomic: true, synthesis: false },
  },
];

// ── Domain coverage dot ──────────────────────────────────────────────────────

function DomainDot({ label, filled }: { label: string; filled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="h-2.5 w-2.5 rounded-full transition-colors"
        style={{ backgroundColor: filled ? "#2DD4BF" : "#3f3f46" }}
      />
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}

// ── Sample investigation card ────────────────────────────────────────────────

function SampleCard({ sample }: { sample: SampleInvestigation }) {
  const params = new URLSearchParams({
    title: sample.title,
    question: sample.question,
  });

  return (
    <Link
      to={`/workbench/investigation/new?${params.toString()}`}
      className="group block bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 hover:shadow-[0_0_0_1px_rgba(45,212,191,0.15)] transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-zinc-100 leading-snug group-hover:text-white transition-colors">
          {sample.title}
        </h3>
        <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5 transition-colors" />
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed mb-4 line-clamp-2">
        {sample.question}
      </p>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sample.badges.map((badge) => (
          <span
            key={badge}
            className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700"
          >
            {badge}
          </span>
        ))}
      </div>

      {/* Domain coverage */}
      <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
        <span className="text-[10px] text-zinc-600 uppercase tracking-wide font-medium">
          Coverage
        </span>
        <div className="flex items-center gap-3">
          <DomainDot label="Phenotype" filled={sample.domains.phenotype} />
          <DomainDot label="Clinical" filled={sample.domains.clinical} />
          <DomainDot label="Genomic" filled={sample.domains.genomic} />
          <DomainDot label="Synthesis" filled={sample.domains.synthesis} />
        </div>
      </div>
    </Link>
  );
}

// ── User investigation card ──────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft:    { bg: "bg-zinc-800",              text: "text-zinc-400",   label: "Draft" },
  active:   { bg: "bg-teal-900/40",           text: "text-teal-400",   label: "Active" },
  complete: { bg: "bg-emerald-900/40",         text: "text-emerald-400", label: "Complete" },
  archived: { bg: "bg-zinc-800/50",            text: "text-zinc-500",   label: "Archived" },
};

function InvestigationCard({ investigation }: { investigation: Investigation }) {
  const style = STATUS_STYLES[investigation.status] ?? STATUS_STYLES.draft;
  const updated = new Date(investigation.updated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      to={`/workbench/investigation/${investigation.id}`}
      className="group block bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 hover:bg-zinc-900/60 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors leading-snug">
          {investigation.title}
        </h4>
        <span
          className={`shrink-0 inline-block px-2 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
      </div>
      {investigation.research_question && (
        <p className="text-xs text-zinc-600 line-clamp-1 mb-2">
          {investigation.research_question}
        </p>
      )}
      <p className="text-[10px] text-zinc-600">Updated {updated}</p>
    </Link>
  );
}

// ── How-it-works step ────────────────────────────────────────────────────────

interface WorkflowStep {
  icon: React.ReactNode;
  label: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    icon: <FileText className="h-5 w-5" style={{ color: "#C9A227" }} />,
    label: "Ask a Question",
    description: "Define your research question and title.",
  },
  {
    icon: <Microscope className="h-5 w-5" style={{ color: "#2DD4BF" }} />,
    label: "Build Phenotype",
    description: "Curate concept sets and cohort definitions.",
  },
  {
    icon: <Activity className="h-5 w-5" style={{ color: "#9B1B30" }} />,
    label: "Gather Evidence",
    description: "Run HADES analyses and pull genomic signals.",
  },
  {
    icon: <Dna className="h-5 w-5" style={{ color: "#2DD4BF" }} />,
    label: "Synthesize Dossier",
    description: "Export a structured Evidence Dossier for publication.",
  },
];

// ── Main landing page ────────────────────────────────────────────────────────

export default function InvestigationLandingPage() {
  const navigate = useNavigate();
  const { data: investigations, isLoading } = useInvestigations();

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: "#0E0E11" }}>
      <div className="max-w-5xl mx-auto space-y-10">

        {/* ── Header ── */}
        <div>
          <Link
            to="/workbench"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-5"
          >
            <ArrowLeft className="h-3 w-3" />
            Workbench
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.25)" }}
              >
                <Dna className="h-5 w-5" style={{ color: "#2DD4BF" }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-100">Evidence Investigation</h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Bridge clinical phenotyping with genomic evidence — from research question to Evidence Dossier
                </p>
              </div>
            </div>

            <button
              onClick={() => void navigate("/workbench/investigation/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90 shrink-0"
              style={{ backgroundColor: "#9B1B30" }}
            >
              <Plus className="h-4 w-4" />
              New Investigation
            </button>
          </div>
        </div>

        {/* ── How It Works ── */}
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
            How It Works
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.label} className="relative flex flex-col items-center text-center px-4 py-5">
                {/* connector line */}
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-[2.75rem] left-[calc(50%+1.5rem)] right-0 h-px bg-zinc-800 z-0" />
                )}
                <div
                  className="relative z-10 h-10 w-10 rounded-xl flex items-center justify-center mb-3 shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid #27272a" }}
                >
                  {step.icon}
                </div>
                <span className="text-xs font-semibold text-zinc-300 mb-1">{step.label}</span>
                <span className="text-[11px] text-zinc-600 leading-relaxed">{step.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sample Investigations ── */}
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-zinc-200">Sample Investigations</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Explore these examples to see the Evidence Investigation workflow in action
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_INVESTIGATIONS.map((sample) => (
              <SampleCard key={sample.title} sample={sample} />
            ))}
          </div>
        </div>

        {/* ── Your Investigations ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Your Investigations</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Recent investigations you have created</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-600 py-6">
              <div className="h-4 w-4 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin" />
              Loading investigations...
            </div>
          ) : investigations && investigations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {investigations.slice(0, 9).map((inv) => (
                <InvestigationCard key={inv.id} investigation={inv} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 py-10 text-center">
              <Dna className="h-8 w-8 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500 mb-1">No investigations yet</p>
              <p className="text-xs text-zinc-600 mb-4">
                Start with a sample above or create a new investigation.
              </p>
              <button
                onClick={() => void navigate("/workbench/investigation/new")}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: "#9B1B30" }}
              >
                <Plus className="h-3.5 w-3.5" />
                New Investigation
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
