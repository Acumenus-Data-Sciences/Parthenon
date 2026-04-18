import {
  RefreshCw,
  Ban,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Progress, CodeBlock, Drawer } from "@/components/ui";
import type { JobDetail, JobType, TimelineEntry } from "../api/jobsApi";
import { useJobDetail } from "../hooks/useJobs";

const jobTypeLabelKeys: Partial<Record<JobType, string>> = {
  characterization: "characterization",
  incidence_rate: "incidenceRate",
  estimation: "estimation",
  prediction: "prediction",
  pathway: "pathway",
  sccs: "sccs",
  evidence_synthesis: "evidenceSynthesis",
  cohort_generation: "cohortGeneration",
  care_gap: "careGaps",
  achilles: "achilles",
  dqd: "dataQuality",
  heel: "heelChecks",
  ingestion: "ingestion",
  vocabulary_load: "vocabulary",
  genomic_parse: "genomicParse",
  poseidon: "poseidon",
  fhir_export: "fhirExport",
  fhir_sync: "fhirSync",
  gis_import: "gisImport",
  gis_boundary: "gisBoundaries",
  analysis: "analysis",
};

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDuration(started: string | null, completed: string | null): string {
  if (!started) return "—";
  const start = new Date(started).getTime();
  const end = completed ? new Date(completed).getTime() : Date.now();
  const ms = end - start;
  if (ms < 0) return "—";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function statusVariant(status: string): "success" | "critical" | "info" | "warning" | "default" {
  switch (status) {
    case "completed": return "success";
    case "failed": return "critical";
    case "running": return "info";
    case "queued": case "pending": return "warning";
    default: return "default";
  }
}

// ─── Shared Subcomponents ───────────────────────────────────────────────

function MetaGrid({ items }: { items: Array<{ label: string; value: string | number | null | undefined; mono?: boolean }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
      {items.map((item) => (
        <div key={item.label}>
          <div className="text-label">{item.label}</div>
          <div className={item.mono ? "text-mono" : ""} style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            {item.value ?? "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-label" style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-xs)", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: "var(--space-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-sm)", marginBottom: 2 }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="text-mono" style={{ color: "var(--text-primary)" }}>{formatNumber(value)} / {formatNumber(total)} ({pct}%)</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--bg-elevated)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

function TimelineView({ entries }: { entries: TimelineEntry[] }) {
  const { t } = useTranslation("app");
  if (entries.length === 0) return null;
  const recent = entries.slice(-30); // Show last 30 entries
  return (
    <DetailSection title={t("jobs.drawer.sections.executionLog")}>
      <div style={{ maxHeight: 300, overflowY: "auto", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>
        {recent.map((entry, i) => {
          const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "";
          const levelColor = entry.level === "ERROR" ? "var(--critical)" : "var(--text-muted)";
          return (
            <div key={i} style={{ display: "flex", gap: "var(--space-2)", padding: "2px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-muted)", minWidth: 70 }}>{time}</span>
              <span style={{ color: levelColor, minWidth: 40 }}>{entry.level}</span>
              <span style={{ color: "var(--text-secondary)", wordBreak: "break-word" }}>{entry.message}</span>
            </div>
          );
        })}
      </div>
    </DetailSection>
  );
}

// ─── Type-Specific Detail Renderers ─────────────────────────────────────

function AnalysisDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  return (
    <DetailSection title={t("jobs.drawer.sections.analysis")}>
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.analysis"), value: details.analysis_name as string },
        { label: t("jobs.drawer.labels.createdBy"), value: details.created_by as string },
      ]} />
      {!!details.analysis_description && (
        <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {String(details.analysis_description)}
        </div>
      )}
      {!!details.parameters && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>
            {t("jobs.drawer.labels.parameters")}
          </div>
          <CodeBlock code={JSON.stringify(details.parameters, null, 2)} language="json" />
        </div>
      )}
    </DetailSection>
  );
}

function CohortDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  return (
    <DetailSection title={t("jobs.drawer.sections.cohort")}>
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.cohort"), value: details.cohort_name as string },
        { label: t("jobs.drawer.labels.personCount"), value: formatNumber(details.person_count as number), mono: true },
        { label: t("jobs.drawer.labels.source"), value: details.source_name as string },
        { label: t("jobs.drawer.labels.sourceKey"), value: details.source_key as string, mono: true },
      ]} />
      {!!details.cohort_description && (
        <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {String(details.cohort_description)}
        </div>
      )}
      {!!details.is_stale && (
        <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-1)", color: "var(--warning)" }}>
          <AlertTriangle size={14} />
          <span style={{ fontSize: "var(--text-sm)" }}>{t("jobs.drawer.messages.stalled")}</span>
        </div>
      )}
    </DetailSection>
  );
}

function IngestionDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  return (
    <DetailSection title={t("jobs.drawer.sections.ingestionPipeline")}>
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.stage"), value: details.pipeline_stage as string },
        { label: t("jobs.drawer.labels.project"), value: details.project_name as string },
        { label: t("jobs.drawer.labels.file"), value: details.file_name as string },
        { label: t("jobs.drawer.labels.fileSize"), value: formatBytes(details.file_size_bytes as number) },
        { label: t("jobs.drawer.labels.mappingCoverage"), value: details.mapping_coverage != null ? `${((details.mapping_coverage as number) * 100).toFixed(1)}%` : null, mono: true },
      ]} />
      {(details.records_total as number) > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <StatBar label={t("jobs.drawer.labels.processed")} value={details.records_processed as number ?? 0} total={details.records_total as number ?? 0} color="var(--success)" />
          {(details.records_failed as number) > 0 && (
            <StatBar label={t("jobs.drawer.labels.failed")} value={details.records_failed as number} total={details.records_total as number ?? 0} color="var(--critical)" />
          )}
        </div>
      )}
    </DetailSection>
  );
}

function FhirSyncDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  const types = details.resource_types as string[] | null;
  return (
    <DetailSection title={t("jobs.drawer.sections.fhirSync")}>
      {types && types.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          {types.map((t) => <Badge key={t} variant="default">{t}</Badge>)}
        </div>
      )}
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.filesDownloaded"), value: formatNumber(details.files_downloaded as number), mono: true },
        { label: t("jobs.drawer.labels.recordsExtracted"), value: formatNumber(details.records_extracted as number), mono: true },
        { label: t("jobs.drawer.labels.recordsMapped"), value: formatNumber(details.records_mapped as number), mono: true },
        { label: t("jobs.drawer.labels.recordsWritten"), value: formatNumber(details.records_written as number), mono: true },
        { label: t("jobs.drawer.labels.recordsFailed"), value: formatNumber(details.records_failed as number), mono: true },
        { label: t("jobs.drawer.labels.mappingCoverage"), value: details.mapping_coverage != null ? `${((details.mapping_coverage as number) * 100).toFixed(1)}%` : null, mono: true },
      ]} />
    </DetailSection>
  );
}

function DqdDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  const passRate = details.pass_rate as number ?? 0;
  const failures = (details.top_failures as Array<{ check: string; category: string; severity: string; description: string; table: string }>) ?? [];
  return (
    <DetailSection title={t("jobs.drawer.sections.dataQuality")}>
      <StatBar label={t("jobs.drawer.labels.passed")} value={details.checks_passed as number ?? 0} total={details.checks_completed as number ?? 0} color="var(--success)" />
      <StatBar label={t("jobs.drawer.labels.failed")} value={details.checks_failed as number ?? 0} total={details.checks_completed as number ?? 0} color="var(--critical)" />
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.passRate"), value: `${passRate}%`, mono: true },
        { label: t("jobs.drawer.labels.expectedChecks"), value: formatNumber(details.total_expected as number), mono: true },
        { label: t("jobs.drawer.labels.executionTime"), value: details.total_execution_ms ? `${((details.total_execution_ms as number) / 1000).toFixed(1)}s` : null, mono: true },
      ]} />
      {failures.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>
            {t("jobs.drawer.labels.failingChecks")}
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>
            {failures.map((f, i) => (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                  <Badge variant={f.severity === "error" ? "critical" : "warning"} style={{ fontSize: "var(--text-xs)" }}>{f.severity}</Badge>
                  <span style={{ color: "var(--text-muted)" }}>{f.category}</span>
                  <span style={{ color: "var(--text-muted)" }}>{f.table}</span>
                </div>
                <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>{f.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DetailSection>
  );
}

function HeelDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  const violations = (details.violations as Array<{ rule_id: number; rule_name: string; severity: string; record_count: number; attribute: string }>) ?? [];
  return (
    <DetailSection title={t("jobs.drawer.sections.heelChecks")}>
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.totalRules"), value: formatNumber(details.total_rules as number), mono: true },
        { label: t("jobs.drawer.labels.rulesTriggered"), value: formatNumber(details.rules_triggered as number), mono: true },
        { label: t("jobs.drawer.labels.totalViolations"), value: formatNumber(details.total_violations as number), mono: true },
      ]} />
      {violations.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>
            {t("jobs.drawer.labels.topViolations")}
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>
            {violations.map((v, i) => (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
                  <div>
                    <Badge variant={v.severity === "Error" ? "critical" : "warning"} style={{ fontSize: "var(--text-xs)", marginRight: "var(--space-1)" }}>{v.severity}</Badge>
                    <span style={{ color: "var(--text-secondary)" }}>{v.rule_name}</span>
                  </div>
                  <span style={{ color: "var(--warning)", whiteSpace: "nowrap" }}>
                    {t("jobs.drawer.messages.records", {
                      count: formatNumber(v.record_count),
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </DetailSection>
  );
}

function AchillesDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  const categories = (details.category_breakdown as Array<{ category: string; total: number; completed: number; failed: number; running: number }>) ?? [];
  const failedSteps = (details.failed_steps as Array<{ analysis_name: string; category: string; error: string }>) ?? [];
  return (
    <DetailSection title={t("jobs.drawer.sections.achillesAnalyses")}>
      <StatBar label={t("jobs.drawer.labels.completed")} value={details.completed_analyses as number ?? 0} total={details.total_analyses as number ?? 0} color="var(--success)" />
      {(details.failed_analyses as number) > 0 && (
        <StatBar label={t("jobs.drawer.labels.failed")} value={details.failed_analyses as number} total={details.total_analyses as number ?? 0} color="var(--critical)" />
      )}
      {categories.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>
            {t("jobs.drawer.labels.byCategory")}
          </div>
          <div style={{ fontSize: "var(--text-xs)" }}>
            {categories.map((c) => (
              <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{c.category}</span>
                <span className="text-mono">
                  <span style={{ color: "var(--success)" }}>{c.completed}</span>
                  {c.failed > 0 && (
                    <span style={{ color: "var(--critical)" }}>
                      {" / "}
                      {t("jobs.drawer.messages.failedCount", { count: c.failed })}
                    </span>
                  )}
                  {c.running > 0 && (
                    <span style={{ color: "var(--info)" }}>
                      {" / "}
                      {t("jobs.drawer.messages.runningCount", { count: c.running })}
                    </span>
                  )}
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}
                    {t("jobs.drawer.messages.ofTotal", { count: c.total })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {failedSteps.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)", color: "var(--critical)" }}>
            {t("jobs.drawer.labels.failedSteps")}
          </div>
          <div style={{ maxHeight: 150, overflowY: "auto", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>
            {failedSteps.map((s, i) => (
              <div key={i} style={{ padding: "3px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ color: "var(--text-primary)" }}>{s.analysis_name}</div>
                {s.error && <div style={{ color: "var(--critical)" }}>{s.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </DetailSection>
  );
}

function GenomicDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  return (
    <DetailSection title={t("jobs.drawer.sections.genomicParse")}>
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.file"), value: details.filename as string },
        { label: t("jobs.drawer.labels.format"), value: details.file_format as string },
        { label: t("jobs.drawer.labels.fileSize"), value: formatBytes(details.file_size_bytes as number) },
        { label: t("jobs.drawer.labels.totalVariants"), value: formatNumber(details.total_variants as number), mono: true },
        { label: t("jobs.drawer.labels.mappedVariants"), value: formatNumber(details.mapped_variants as number), mono: true },
        { label: t("jobs.drawer.labels.samples"), value: formatNumber(details.sample_count as number), mono: true },
      ]} />
    </DetailSection>
  );
}

function PoseidonDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  const stats = details.stats as Record<string, unknown> | null;
  return (
    <DetailSection title={t("jobs.drawer.sections.poseidonEtl")}>
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.runType"), value: details.run_type as string },
        { label: t("jobs.drawer.labels.dagsterRunId"), value: details.dagster_run_id as string, mono: true },
      ]} />
      {stats && Object.keys(stats).length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>
            {t("jobs.drawer.labels.stats")}
          </div>
          <CodeBlock code={JSON.stringify(stats, null, 2)} language="json" />
        </div>
      )}
    </DetailSection>
  );
}

function CareGapDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  return (
    <DetailSection title={t("jobs.drawer.sections.careGapEvaluation")}>
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.bundle"), value: details.bundle_name as string },
        { label: t("jobs.drawer.labels.personCount"), value: formatNumber(details.person_count as number), mono: true },
        { label: t("jobs.drawer.labels.cohort"), value: details.cohort_definition as string },
      ]} />
      {!!details.compliance_summary && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>
            {t("jobs.drawer.labels.complianceSummary")}
          </div>
          <CodeBlock code={JSON.stringify(details.compliance_summary, null, 2)} language="json" />
        </div>
      )}
    </DetailSection>
  );
}

function GisDetails({ details, type }: { details: Record<string, unknown>; type: string }) {
  const { t } = useTranslation("app");
  const isBoundary = type === "gis_boundary";
  return (
    <DetailSection title={isBoundary ? t("jobs.drawer.sections.gisBoundaries") : t("jobs.drawer.sections.gisImport")}>
      <MetaGrid items={[
        ...(isBoundary ? [
          { label: t("jobs.drawer.labels.dataset"), value: details.dataset_name as string },
          { label: t("jobs.drawer.labels.dataType"), value: details.data_type as string },
          { label: t("jobs.drawer.labels.source"), value: details.source_name as string },
          { label: t("jobs.drawer.labels.version"), value: details.source_version as string },
        ] : [
          { label: t("jobs.drawer.labels.file"), value: details.filename as string },
          { label: t("jobs.drawer.labels.fileSize"), value: formatBytes(details.file_size_bytes as number) },
        ]),
        { label: t("jobs.drawer.labels.geometry"), value: details.geometry_type as string },
        { label: t("jobs.drawer.labels.features"), value: formatNumber(details.feature_count as number), mono: true },
      ]} />
      {isBoundary && !!details.levels_requested && (
        <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
          {(details.levels_requested as string[]).map((l) => <Badge key={l} variant="default">{l}</Badge>)}
        </div>
      )}
    </DetailSection>
  );
}

function VocabularyDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  return (
    <DetailSection title={t("jobs.drawer.sections.vocabularyImport")}>
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.file"), value: details.file_name as string },
        { label: t("jobs.drawer.labels.version"), value: details.vocabulary_version as string },
        { label: t("jobs.drawer.labels.tablesLoaded"), value: formatNumber(details.tables_loaded as number), mono: true },
        { label: t("jobs.drawer.labels.recordsLoaded"), value: formatNumber(details.records_loaded as number), mono: true },
      ]} />
    </DetailSection>
  );
}

function FhirExportDetails({ details }: { details: Record<string, unknown> }) {
  const { t } = useTranslation("app");
  const types = details.resource_types as string[] | null;
  return (
    <DetailSection title={t("jobs.drawer.sections.fhirExport")}>
      {types && types.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
          {types.map((t) => <Badge key={t} variant="default">{t}</Badge>)}
        </div>
      )}
      <MetaGrid items={[
        { label: t("jobs.drawer.labels.outputFormat"), value: details.output_format as string },
      ]} />
    </DetailSection>
  );
}

// ─── Type-specific detail router ────────────────────────────────────────

function TypeDetails({ job }: { job: JobDetail }) {
  const d = job.details;
  if (!d || Object.keys(d).length === 0) return null;

  switch (job.type) {
    case "characterization":
    case "incidence_rate":
    case "estimation":
    case "prediction":
    case "pathway":
    case "sccs":
    case "evidence_synthesis":
    case "analysis":
      return <AnalysisDetails details={d} />;
    case "cohort_generation":
      return <CohortDetails details={d} />;
    case "ingestion":
      return <IngestionDetails details={d} />;
    case "fhir_export":
      return <FhirExportDetails details={d} />;
    case "fhir_sync":
      return <FhirSyncDetails details={d} />;
    case "gis_import":
    case "gis_boundary":
      return <GisDetails details={d} type={job.type} />;
    case "genomic_parse":
      return <GenomicDetails details={d} />;
    case "vocabulary_load":
      return <VocabularyDetails details={d} />;
    case "dqd":
      return <DqdDetails details={d} />;
    case "heel":
      return <HeelDetails details={d} />;
    case "achilles":
      return <AchillesDetails details={d} />;
    case "care_gap":
      return <CareGapDetails details={d} />;
    case "poseidon":
      return <PoseidonDetails details={d} />;
    default:
      return null;
  }
}

// ─── Main Drawer Component ──────────────────────────────────────────────

interface JobDetailDrawerProps {
  jobId: number | null;
  jobType: JobType | null;
  onClose: () => void;
  onRetry: (job: { id: number; type: JobType }) => void;
  onCancel: (job: { id: number; type: JobType }) => void;
}

export function JobDetailDrawer({ jobId, jobType, onClose, onRetry, onCancel }: JobDetailDrawerProps) {
  const { t } = useTranslation("app");
  const { data: job, isLoading, isError } = useJobDetail(jobId, jobType);
  const jobTypeLabel = (type: JobType | string) => {
    const labelKey = jobTypeLabelKeys[type as JobType];
    return labelKey
      ? t(`jobs.filters.types.${labelKey}`)
      : String(type).replace(/_/g, " ");
  };
  const statusLabel = (status: string) =>
    t(`jobs.filters.statuses.${status}`, {
      defaultValue: status.replace(/_/g, " "),
    });

  return (
    <Drawer
      open={jobId != null}
      onClose={onClose}
      title={job?.name ?? t("jobs.drawer.titleFallback")}
      size="lg"
    >
      {isLoading && (
        <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)", margin: "0 auto" }} />
        </div>
      )}

      {isError && (
        <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--text-muted)" }}>
          {t("jobs.drawer.loadError")}
        </div>
      )}

      {job && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Status header */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Badge variant={statusVariant(job.status)}>
              {statusLabel(job.status)}
            </Badge>
            {job.status === "running" && job.progress > 0 && (
              <div style={{ flex: 1 }}>
                <Progress value={job.progress} variant="info" />
                <div className="text-mono" style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                  {job.progress}%
                </div>
              </div>
            )}
          </div>

          {/* Core metadata */}
          <DetailSection title={t("jobs.drawer.sections.overview")}>
            <MetaGrid items={[
              { label: t("jobs.drawer.labels.type"), value: jobTypeLabel(job.type) },
              { label: t("jobs.drawer.labels.source"), value: job.source_name },
              { label: t("jobs.drawer.labels.triggeredBy"), value: job.triggered_by },
              { label: t("jobs.drawer.labels.duration"), value: formatDuration(job.started_at, job.completed_at), mono: true },
              { label: t("jobs.drawer.labels.started"), value: formatTimestamp(job.started_at) },
              { label: t("jobs.drawer.labels.completed"), value: formatTimestamp(job.completed_at) },
              { label: t("jobs.drawer.labels.created"), value: formatTimestamp(job.created_at) },
            ]} />
          </DetailSection>

          {/* Error message */}
          {job.error_message && (
            <div className="alert-card alert-critical">
              <XCircle size={16} className="alert-icon" />
              <div className="alert-content">
                <div className="alert-title">{t("jobs.drawer.labels.error")}</div>
                <div className="alert-message">{job.error_message}</div>
              </div>
            </div>
          )}

          {/* Log output (brief) */}
          {job.log_output && (
            <DetailSection title={t("jobs.drawer.sections.output")}>
              <CodeBlock code={job.log_output} language="log" />
            </DetailSection>
          )}

          {/* Type-specific details */}
          <TypeDetails job={job} />

          {/* Execution timeline */}
          <TimelineView entries={job.timeline} />

          {/* Actions */}
          <div style={{ display: "flex", gap: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--border-default)" }}>
            {job.actions.retry && (
              <button className="btn btn-primary btn-sm" onClick={() => onRetry({ id: job.id, type: job.type })}>
                <RefreshCw size={14} /> {t("jobs.actions.retry")}
              </button>
            )}
            {job.actions.cancel && (
              <button className="btn btn-danger btn-sm" onClick={() => onCancel({ id: job.id, type: job.type })}>
                <Ban size={14} /> {t("jobs.actions.cancel")}
              </button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
