import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useInvestigationStore } from "../stores/investigationStore";
import type {
  ClinicalState,
  EvidenceDomain,
  GenomicState,
  Investigation,
} from "../types";
import { ContextCard } from "./ContextCard";
import {
  formatInvestigationCount,
  getInvestigationDomainLabel,
} from "../lib/i18n";

interface ContextBarProps {
  investigation: Investigation;
}

function getPhenotypeSummary(t: TFunction<"app">, investigation: Investigation): string {
  const count = investigation.phenotype_state.concept_sets?.length ?? 0;
  return count > 0
    ? formatInvestigationCount(t, "conceptSet", count)
    : t("investigation.common.empty.noConcepts");
}

function getClinicalSummary(t: TFunction<"app">, state: ClinicalState): string {
  const analyses = state.queued_analyses ?? [];
  if (analyses.length === 0) {
    return t("investigation.common.empty.noAnalyses");
  }

  const running = analyses.filter(
    (a) => a.status === "running" || a.status === "queued",
  ).length;
  const completed = analyses.filter((a) => a.status === "complete").length;
  const failed = analyses.filter((a) => a.status === "failed").length;

  const parts: string[] = [];
  if (completed > 0) {
    parts.push(t("investigation.common.counts.completed", { count: completed }));
  }
  if (running > 0) {
    parts.push(t("investigation.common.counts.running", { count: running }));
  }
  if (failed > 0) {
    parts.push(t("investigation.common.counts.failed", { count: failed }));
  }

  return parts.join(" · ") || t("investigation.common.empty.noAnalyses");
}

function ClinicalSummaryNode({
  t,
  state,
}: {
  t: TFunction<"app">;
  state: ClinicalState;
}): React.ReactElement {
  const analyses = state.queued_analyses ?? [];

  if (analyses.length === 0) {
    return (
      <span className="text-text-ghost">
        {t("investigation.common.empty.noAnalyses")}
      </span>
    );
  }

  const running = analyses.filter(
    (a) => a.status === "running" || a.status === "queued",
  ).length;
  const completed = analyses.filter((a) => a.status === "complete").length;
  const failed = analyses.filter((a) => a.status === "failed").length;

  const parts: React.ReactElement[] = [];

  if (completed > 0) {
    parts.push(
      <span key="complete" style={{ color: "var(--success)" }}>
        {t("investigation.common.counts.completed", { count: completed })}
      </span>,
    );
  }
  if (running > 0) {
    parts.push(
      <span key="running" style={{ color: "var(--accent)" }}>
        {t("investigation.common.counts.running", { count: running })}
      </span>,
    );
  }
  if (failed > 0) {
    parts.push(
      <span key="failed" style={{ color: "var(--primary)" }}>
        {t("investigation.common.counts.failed", { count: failed })}
      </span>,
    );
  }

  if (parts.length === 0) {
    return (
      <span className="text-text-ghost">
        {t("investigation.common.empty.noAnalyses")}
      </span>
    );
  }

  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="text-text-ghost"> · </span>}
          {part}
        </span>
      ))}
    </>
  );
}

function getGenomicSummary(t: TFunction<"app">, state: GenomicState): string {
  const queries =
    (state.open_targets_queries?.length ?? 0) +
    (state.gwas_catalog_queries?.length ?? 0);
  const uploads = state.uploaded_gwas?.length ?? 0;
  if (queries === 0 && uploads === 0) {
    return t("investigation.common.empty.noEvidence");
  }

  const parts: string[] = [];
  if (queries > 0) {
    parts.push(formatInvestigationCount(t, "query", queries));
  }
  if (uploads > 0) {
    parts.push(formatInvestigationCount(t, "upload", uploads));
  }
  return parts.join(" · ");
}

function getSynthesisSummary(
  t: TFunction<"app">,
  investigation: Investigation,
): string {
  const pinCount = investigation.pins?.length ?? 0;
  const sections = investigation.synthesis_state.section_order?.length ?? 0;
  return pinCount > 0 || sections > 0
    ? `${formatInvestigationCount(t, "pin", pinCount)}, ${formatInvestigationCount(t, "section", sections)}`
    : t("investigation.common.empty.none");
}

const DOMAIN_ORDER: EvidenceDomain[] = [
  "phenotype",
  "clinical",
  "genomic",
  "synthesis",
];

interface KpiMetric {
  label: string;
  value: number;
}

function KpiMetricCard({ metric }: { metric: KpiMetric }) {
  return (
    <div className="bg-surface-base/50 border border-border-default rounded-lg px-3 py-2 flex flex-col items-center min-w-[72px]">
      <span className="text-2xl font-bold text-text-primary leading-none">
        {metric.value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-text-ghost mt-1 whitespace-nowrap">
        {metric.label}
      </span>
    </div>
  );
}

export function ContextBar({ investigation }: ContextBarProps) {
  const { t } = useTranslation("app");
  const { activeDomain, setActiveDomain } = useInvestigationStore();

  const summaries: Record<EvidenceDomain, string> = {
    phenotype: getPhenotypeSummary(t, investigation),
    clinical: getClinicalSummary(t, investigation.clinical_state),
    genomic: getGenomicSummary(t, investigation.genomic_state),
    synthesis: getSynthesisSummary(t, investigation),
    "code-explorer": t("investigation.common.empty.none"),
  };

  const kpiMetrics: KpiMetric[] = [
    {
      label: t("investigation.common.labels.conceptSets"),
      value: investigation.phenotype_state.concept_sets?.length ?? 0,
    },
    {
      label: t("investigation.common.labels.cohorts"),
      value: investigation.phenotype_state.selected_cohort_ids?.length ?? 0,
    },
    {
      label: t("investigation.common.labels.analyses"),
      value: investigation.clinical_state.queued_analyses?.length ?? 0,
    },
    {
      label: t("investigation.common.labels.pins"),
      value: investigation.pins?.length ?? 0,
    },
  ];

  const allZero = kpiMetrics.every((m) => m.value === 0);

  return (
    <div className="flex flex-col border-b border-border-default bg-surface-darkest">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        {allZero ? (
          <p className="text-xs text-text-ghost italic">
            {t("investigation.common.labels.startExploring")}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            {kpiMetrics.map((metric) => (
              <KpiMetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 px-4 pb-3">
        {DOMAIN_ORDER.map((domain) => (
          <ContextCard
            key={domain}
            domain={domain}
            label={getInvestigationDomainLabel(t, domain)}
            summary={summaries[domain]}
            summaryNode={
              domain === "clinical" ? (
                <ClinicalSummaryNode t={t} state={investigation.clinical_state} />
              ) : undefined
            }
            isActive={activeDomain === domain}
            onClick={() => setActiveDomain(domain)}
          />
        ))}
      </div>
    </div>
  );
}
