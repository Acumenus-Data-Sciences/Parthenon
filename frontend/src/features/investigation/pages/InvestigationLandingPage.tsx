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
        style={{ backgroundColor: filled ? "var(--success)" : "var(--surface-highlight)" }}
      />
      <span className="text-[10px] text-text-ghost">{label}</span>
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
      className="group block bg-surface-base/50 border border-border-default rounded-2xl p-5 hover:border-border-hover hover:shadow-[0_0_0_1px_rgba(45,212,191,0.15)] transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-text-primary leading-snug group-hover:text-text-primary transition-colors">
          {sample.title}
        </h3>
        <ChevronRight className="h-4 w-4 text-text-ghost group-hover:text-text-muted shrink-0 mt-0.5 transition-colors" />
      </div>

      <p className="text-xs text-text-ghost leading-relaxed mb-4 line-clamp-2">
        {sample.question}
      </p>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {sample.badges.map((badge) => (
          <span
            key={badge}
            className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-surface-raised text-text-muted border border-border-default"
          >
            {badge}
          </span>
        ))}
      </div>

      {/* Domain coverage */}
      <div className="flex items-center gap-4 pt-3 border-t border-border-default">
        <span className="text-[10px] text-text-ghost uppercase tracking-wide font-medium">
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
  draft:    { bg: "bg-surface-raised",              text: "text-text-muted",   label: "Draft" },
  active:   { bg: "bg-teal-900/40",           text: "text-teal-400",   label: "Active" },
  complete: { bg: "bg-emerald-900/40",         text: "text-emerald-400", label: "Complete" },
  archived: { bg: "bg-surface-raised/50",            text: "text-text-ghost",   label: "Archived" },
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
      className="group block bg-surface-base/40 border border-border-default rounded-xl p-4 hover:border-border-hover hover:bg-surface-base/60 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-text-primary group-hover:text-text-primary transition-colors leading-snug">
          {investigation.title}
        </h4>
        <span
          className={`shrink-0 inline-block px-2 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
      </div>
      {investigation.research_question && (
        <p className="text-xs text-text-ghost line-clamp-1 mb-2">
          {investigation.research_question}
        </p>
      )}
      <p className="text-[10px] text-text-ghost">Updated {updated}</p>
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
    icon: <FileText className="h-5 w-5" style={{ color: "var(--accent)" }} />,
    label: "Ask a Question",
    description: "Define your research question and title.",
  },
  {
    icon: <Microscope className="h-5 w-5" style={{ color: "var(--success)" }} />,
    label: "Build Phenotype",
    description: "Curate concept sets and cohort definitions.",
  },
  {
    icon: <Activity className="h-5 w-5" style={{ color: "var(--primary)" }} />,
    label: "Gather Evidence",
    description: "Run HADES analyses and pull genomic signals.",
  },
  {
    icon: <Dna className="h-5 w-5" style={{ color: "var(--success)" }} />,
    label: "Synthesize Dossier",
    description: "Export a structured Evidence Dossier for publication.",
  },
];

// ── Main landing page ────────────────────────────────────────────────────────

export default function InvestigationLandingPage() {
  const navigate = useNavigate();
  const { data: investigations, isLoading } = useInvestigations();

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: "var(--surface-base)" }}>
      <div className="max-w-5xl mx-auto space-y-10">

        {/* ── Header ── */}
        <div>
          <Link
            to="/workbench"
            className="inline-flex items-center gap-1.5 text-xs text-text-ghost hover:text-text-secondary transition-colors mb-5"
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
                <Dna className="h-5 w-5" style={{ color: "var(--success)" }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">Evidence Investigation</h1>
                <p className="text-sm text-text-ghost mt-0.5">
                  Bridge clinical phenotyping with genomic evidence — from research question to Evidence Dossier
                </p>
              </div>
            </div>

            <button
              onClick={() => void navigate("/workbench/investigation/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-text-primary transition-colors hover:opacity-90 shrink-0"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <Plus className="h-4 w-4" />
              New Investigation
            </button>
          </div>
        </div>

        {/* ── How It Works ── */}
        <div>
          <h2 className="text-xs font-semibold text-text-ghost uppercase tracking-widest mb-4">
            How It Works
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.label} className="relative flex flex-col items-center text-center px-4 py-5">
                {/* connector line */}
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-[2.75rem] left-[calc(50%+1.5rem)] right-0 h-px bg-surface-raised z-0" />
                )}
                <div
                  className="relative z-10 h-10 w-10 rounded-xl flex items-center justify-center mb-3 shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid #27272a" }}
                >
                  {step.icon}
                </div>
                <span className="text-xs font-semibold text-text-secondary mb-1">{step.label}</span>
                <span className="text-[11px] text-text-ghost leading-relaxed">{step.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sample Investigations ── */}
        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Sample Investigations</h2>
            <p className="text-xs text-text-ghost mt-0.5">
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
              <h2 className="text-sm font-semibold text-text-primary">Your Investigations</h2>
              <p className="text-xs text-text-ghost mt-0.5">Recent investigations you have created</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-ghost py-6">
              <div className="h-4 w-4 rounded-full border-2 border-border-default border-t-zinc-400 animate-spin" />
              Loading investigations...
            </div>
          ) : investigations && investigations.data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {investigations.data.slice(0, 9).map((inv: Investigation) => (
                <InvestigationCard key={inv.id} investigation={inv} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border-default py-10 text-center">
              <Dna className="h-8 w-8 mx-auto mb-3 text-text-ghost" />
              <p className="text-sm text-text-ghost mb-1">No investigations yet</p>
              <p className="text-xs text-text-ghost mb-4">
                Start with a sample above or create a new investigation.
              </p>
              <button
                onClick={() => void navigate("/workbench/investigation/new")}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text-primary transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--primary)" }}
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
