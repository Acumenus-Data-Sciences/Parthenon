import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Dna,
  FileText,
  Microscope,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useInvestigations } from "../hooks/useInvestigation";
import type { Investigation } from "../types";
import {
  formatInvestigationDate,
  getInvestigationStatusLabel,
} from "../lib/i18n";

interface SampleInvestigation {
  title: string;
  question: string;
  badges: string[];
  domains: {
    phenotype: boolean;
    clinical: boolean;
    genomic: boolean;
    synthesis: boolean;
  };
}

interface WorkflowStep {
  icon: React.ReactNode;
  label: string;
  description: string;
}

function DomainDot({ label, filled }: { label: string; filled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="h-2.5 w-2.5 rounded-full transition-colors"
        style={{
          backgroundColor: filled ? "var(--success)" : "var(--surface-highlight)",
        }}
      />
      <span className="text-[10px] text-text-ghost">{label}</span>
    </div>
  );
}

function SampleCard({ sample }: { sample: SampleInvestigation }) {
  const { t } = useTranslation("app");
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

      <div className="flex items-center gap-4 pt-3 border-t border-border-default">
        <span className="text-[10px] text-text-ghost uppercase tracking-wide font-medium">
          {t("investigation.common.labels.coverage")}
        </span>
        <div className="flex items-center gap-3">
          <DomainDot
            label={t("investigation.common.domains.phenotype")}
            filled={sample.domains.phenotype}
          />
          <DomainDot
            label={t("investigation.common.domains.clinical")}
            filled={sample.domains.clinical}
          />
          <DomainDot
            label={t("investigation.common.domains.genomic")}
            filled={sample.domains.genomic}
          />
          <DomainDot
            label={t("investigation.common.domains.synthesis")}
            filled={sample.domains.synthesis}
          />
        </div>
      </div>
    </Link>
  );
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-surface-raised", text: "text-text-muted" },
  active: { bg: "bg-teal-900/40", text: "text-teal-400" },
  complete: { bg: "bg-emerald-900/40", text: "text-emerald-400" },
  archived: { bg: "bg-surface-raised/50", text: "text-text-ghost" },
};

function InvestigationCard({ investigation }: { investigation: Investigation }) {
  const { t, i18n } = useTranslation("app");
  const style = STATUS_STYLES[investigation.status] ?? STATUS_STYLES.draft;
  const updated = formatInvestigationDate(
    i18n.resolvedLanguage,
    investigation.updated_at,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

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
          {getInvestigationStatusLabel(t, investigation.status)}
        </span>
      </div>
      {investigation.research_question && (
        <p className="text-xs text-text-ghost line-clamp-1 mb-2">
          {investigation.research_question}
        </p>
      )}
      <p className="text-[10px] text-text-ghost">
        {t("investigation.common.labels.updated", { date: updated })}
      </p>
    </Link>
  );
}

export default function InvestigationLandingPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { data: investigations, isLoading } = useInvestigations();

  const workflowSteps: WorkflowStep[] = [
    {
      icon: <FileText className="h-5 w-5" style={{ color: "var(--accent)" }} />,
      label: t("investigation.landing.workflow.askQuestion.label"),
      description: t("investigation.landing.workflow.askQuestion.description"),
    },
    {
      icon: (
        <Microscope className="h-5 w-5" style={{ color: "var(--success)" }} />
      ),
      label: t("investigation.landing.workflow.buildPhenotype.label"),
      description: t(
        "investigation.landing.workflow.buildPhenotype.description",
      ),
    },
    {
      icon: <Activity className="h-5 w-5" style={{ color: "var(--primary)" }} />,
      label: t("investigation.landing.workflow.gatherEvidence.label"),
      description: t(
        "investigation.landing.workflow.gatherEvidence.description",
      ),
    },
    {
      icon: <Dna className="h-5 w-5" style={{ color: "var(--success)" }} />,
      label: t("investigation.landing.workflow.synthesizeDossier.label"),
      description: t(
        "investigation.landing.workflow.synthesizeDossier.description",
      ),
    },
  ];

  const sampleInvestigations: SampleInvestigation[] = [
    {
      title: t("investigation.landing.sampleInvestigations.ckd.title"),
      question: t("investigation.landing.sampleInvestigations.ckd.question"),
      badges: [
        t("investigation.landing.sampleInvestigations.ckd.badges.conceptSets"),
        t("investigation.landing.sampleInvestigations.ckd.badges.cohorts"),
        t("investigation.landing.sampleInvestigations.ckd.badges.estimation"),
        t("investigation.landing.sampleInvestigations.ckd.badges.loci"),
      ],
      domains: {
        phenotype: true,
        clinical: true,
        genomic: true,
        synthesis: false,
      },
    },
    {
      title: t("investigation.landing.sampleInvestigations.statin.title"),
      question: t("investigation.landing.sampleInvestigations.statin.question"),
      badges: [
        t("investigation.landing.sampleInvestigations.statin.badges.conceptSets"),
        t("investigation.landing.sampleInvestigations.statin.badges.cohorts"),
        t(
          "investigation.landing.sampleInvestigations.statin.badges.characterization",
        ),
        t("investigation.landing.sampleInvestigations.statin.badges.estimation"),
      ],
      domains: {
        phenotype: true,
        clinical: true,
        genomic: false,
        synthesis: false,
      },
    },
    {
      title: t("investigation.landing.sampleInvestigations.tcf7l2.title"),
      question: t("investigation.landing.sampleInvestigations.tcf7l2.question"),
      badges: [
        t("investigation.landing.sampleInvestigations.tcf7l2.badges.conceptSet"),
        t("investigation.landing.sampleInvestigations.tcf7l2.badges.cohort"),
        t(
          "investigation.landing.sampleInvestigations.tcf7l2.badges.associations",
        ),
        t("investigation.landing.sampleInvestigations.tcf7l2.badges.loci"),
      ],
      domains: {
        phenotype: true,
        clinical: false,
        genomic: true,
        synthesis: false,
      },
    },
  ];

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ backgroundColor: "var(--surface-base)" }}
    >
      <div className="max-w-5xl mx-auto space-y-10">
        <div>
          <Link
            to="/workbench"
            className="inline-flex items-center gap-1.5 text-xs text-text-ghost hover:text-text-secondary transition-colors mb-5"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("layout.nav.workbench")}
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: "rgba(45,212,191,0.12)",
                  border: "1px solid rgba(45,212,191,0.25)",
                }}
              >
                <Dna className="h-5 w-5" style={{ color: "var(--success)" }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  {t("investigation.landing.title")}
                </h1>
                <p className="text-sm text-text-ghost mt-0.5">
                  {t("investigation.landing.subtitle")}
                </p>
              </div>
            </div>

            <button
              onClick={() => void navigate("/workbench/investigation/new")}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-text-primary transition-colors hover:opacity-90 shrink-0"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <Plus className="h-4 w-4" />
              {t("investigation.common.actions.newInvestigation")}
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-text-ghost uppercase tracking-widest mb-4">
            {t("investigation.common.labels.howItWorks")}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
            {workflowSteps.map((step, idx) => (
              <div
                key={step.label}
                className="relative flex flex-col items-center text-center px-4 py-5"
              >
                {idx < workflowSteps.length - 1 && (
                  <div className="hidden sm:block absolute top-[2.75rem] left-[calc(50%+1.5rem)] right-0 h-px bg-surface-raised z-0" />
                )}
                <div
                  className="relative z-10 h-10 w-10 rounded-xl flex items-center justify-center mb-3 shrink-0"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {step.icon}
                </div>
                <span className="text-xs font-semibold text-text-secondary mb-1">
                  {step.label}
                </span>
                <span className="text-[11px] text-text-ghost leading-relaxed">
                  {step.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-text-primary">
              {t("investigation.common.labels.sampleInvestigations")}
            </h2>
            <p className="text-xs text-text-ghost mt-0.5">
              {t("investigation.common.labels.sampleInvestigationsSubtitle")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleInvestigations.map((sample) => (
              <SampleCard key={sample.title} sample={sample} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                {t("investigation.common.labels.yourInvestigations")}
              </h2>
              <p className="text-xs text-text-ghost mt-0.5">
                {t("investigation.common.labels.yourInvestigationsSubtitle")}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-ghost py-6">
              <div className="h-4 w-4 rounded-full border-2 border-border-default border-t-zinc-400 animate-spin" />
              {t("investigation.common.messages.finngenLoading")}
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
              <p className="text-sm text-text-ghost mb-1">
                {t("investigation.common.empty.noInvestigationsYet")}
              </p>
              <p className="text-xs text-text-ghost mb-4">
                {t("investigation.landing.noInvestigations")}
              </p>
              <button
                onClick={() => void navigate("/workbench/investigation/new")}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text-primary transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--primary)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                {t("investigation.common.actions.newInvestigation")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
