import {
  RefreshCw,
  Ban,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Badge, Progress, CodeBlock, Drawer } from "@/components/ui";
import type { JobDetail, JobType, TimelineEntry } from "../api/jobsApi";
import { useJobDetail } from "../hooks/useJobs";

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
  if (entries.length === 0) return null;
  const recent = entries.slice(-30); // Show last 30 entries
  return (
    <DetailSection title="Execution Log">
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
  return (
    <DetailSection title="Analysis">
      <MetaGrid items={[
        { label: "Analysis", value: details.analysis_name as string },
        { label: "Created By", value: details.created_by as string },
      ]} />
      {!!details.analysis_description && (
        <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {String(details.analysis_description)}
        </div>
      )}
      {!!details.parameters && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>Parameters</div>
          <CodeBlock code={JSON.stringify(details.parameters, null, 2)} language="json" />
        </div>
      )}
    </DetailSection>
  );
}

function CohortDetails({ details }: { details: Record<string, unknown> }) {
  return (
    <DetailSection title="Cohort">
      <MetaGrid items={[
        { label: "Cohort", value: details.cohort_name as string },
        { label: "Person Count", value: formatNumber(details.person_count as number), mono: true },
        { label: "Source", value: details.source_name as string },
        { label: "Source Key", value: details.source_key as string, mono: true },
      ]} />
      {!!details.cohort_description && (
        <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {String(details.cohort_description)}
        </div>
      )}
      {!!details.is_stale && (
        <div style={{ marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-1)", color: "var(--warning)" }}>
          <AlertTriangle size={14} />
          <span style={{ fontSize: "var(--text-sm)" }}>This job stalled and was marked as failed after exceeding the 1-hour timeout.</span>
        </div>
      )}
    </DetailSection>
  );
}

function IngestionDetails({ details }: { details: Record<string, unknown> }) {
  return (
    <DetailSection title="Ingestion Pipeline">
      <MetaGrid items={[
        { label: "Stage", value: details.pipeline_stage as string },
        { label: "Project", value: details.project_name as string },
        { label: "File", value: details.file_name as string },
        { label: "File Size", value: formatBytes(details.file_size_bytes as number) },
        { label: "Mapping Coverage", value: details.mapping_coverage != null ? `${((details.mapping_coverage as number) * 100).toFixed(1)}%` : null, mono: true },
      ]} />
      {(details.records_total as number) > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <StatBar label="Processed" value={details.records_processed as number ?? 0} total={details.records_total as number ?? 0} color="var(--success)" />
          {(details.records_failed as number) > 0 && (
            <StatBar label="Failed" value={details.records_failed as number} total={details.records_total as number ?? 0} color="var(--critical)" />
          )}
        </div>
      )}
    </DetailSection>
  );
}

function FhirSyncDetails({ details }: { details: Record<string, unknown> }) {
  const types = details.resource_types as string[] | null;
  return (
    <DetailSection title="FHIR Sync">
      {types && types.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
          {types.map((t) => <Badge key={t} variant="default">{t}</Badge>)}
        </div>
      )}
      <MetaGrid items={[
        { label: "Files Downloaded", value: formatNumber(details.files_downloaded as number), mono: true },
        { label: "Records Extracted", value: formatNumber(details.records_extracted as number), mono: true },
        { label: "Records Mapped", value: formatNumber(details.records_mapped as number), mono: true },
        { label: "Records Written", value: formatNumber(details.records_written as number), mono: true },
        { label: "Records Failed", value: formatNumber(details.records_failed as number), mono: true },
        { label: "Mapping Coverage", value: details.mapping_coverage != null ? `${((details.mapping_coverage as number) * 100).toFixed(1)}%` : null, mono: true },
      ]} />
    </DetailSection>
  );
}

function DqdDetails({ details }: { details: Record<string, unknown> }) {
  const passRate = details.pass_rate as number ?? 0;
  const failures = (details.top_failures as Array<{ check: string; category: string; severity: string; description: string; table: string }>) ?? [];
  return (
    <DetailSection title="Data Quality">
      <StatBar label="Passed" value={details.checks_passed as number ?? 0} total={details.checks_completed as number ?? 0} color="var(--success)" />
      <StatBar label="Failed" value={details.checks_failed as number ?? 0} total={details.checks_completed as number ?? 0} color="var(--critical)" />
      <MetaGrid items={[
        { label: "Pass Rate", value: `${passRate}%`, mono: true },
        { label: "Expected Checks", value: formatNumber(details.total_expected as number), mono: true },
        { label: "Execution Time", value: details.total_execution_ms ? `${((details.total_execution_ms as number) / 1000).toFixed(1)}s` : null, mono: true },
      ]} />
      {failures.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>Failing Checks</div>
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
  const violations = (details.violations as Array<{ rule_id: number; rule_name: string; severity: string; record_count: number; attribute: string }>) ?? [];
  return (
    <DetailSection title="Heel Checks">
      <MetaGrid items={[
        { label: "Total Rules", value: formatNumber(details.total_rules as number), mono: true },
        { label: "Rules Triggered", value: formatNumber(details.rules_triggered as number), mono: true },
        { label: "Total Violations", value: formatNumber(details.total_violations as number), mono: true },
      ]} />
      {violations.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>Top Violations</div>
          <div style={{ maxHeight: 200, overflowY: "auto", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>
            {violations.map((v, i) => (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
                  <div>
                    <Badge variant={v.severity === "Error" ? "critical" : "warning"} style={{ fontSize: "var(--text-xs)", marginRight: "var(--space-1)" }}>{v.severity}</Badge>
                    <span style={{ color: "var(--text-secondary)" }}>{v.rule_name}</span>
                  </div>
                  <span style={{ color: "var(--warning)", whiteSpace: "nowrap" }}>{formatNumber(v.record_count)} records</span>
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
  const categories = (details.category_breakdown as Array<{ category: string; total: number; completed: number; failed: number; running: number }>) ?? [];
  const failedSteps = (details.failed_steps as Array<{ analysis_name: string; category: string; error: string }>) ?? [];
  return (
    <DetailSection title="Achilles Analyses">
      <StatBar label="Completed" value={details.completed_analyses as number ?? 0} total={details.total_analyses as number ?? 0} color="var(--success)" />
      {(details.failed_analyses as number) > 0 && (
        <StatBar label="Failed" value={details.failed_analyses as number} total={details.total_analyses as number ?? 0} color="var(--critical)" />
      )}
      {categories.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>By Category</div>
          <div style={{ fontSize: "var(--text-xs)" }}>
            {categories.map((c) => (
              <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{c.category}</span>
                <span className="text-mono">
                  <span style={{ color: "var(--success)" }}>{c.completed}</span>
                  {c.failed > 0 && <span style={{ color: "var(--critical)" }}> / {c.failed} failed</span>}
                  {c.running > 0 && <span style={{ color: "var(--info)" }}> / {c.running} running</span>}
                  <span style={{ color: "var(--text-muted)" }}> of {c.total}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {failedSteps.length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)", color: "var(--critical)" }}>Failed Steps</div>
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
  return (
    <DetailSection title="Genomic Parse">
      <MetaGrid items={[
        { label: "File", value: details.filename as string },
        { label: "Format", value: details.file_format as string },
        { label: "File Size", value: formatBytes(details.file_size_bytes as number) },
        { label: "Total Variants", value: formatNumber(details.total_variants as number), mono: true },
        { label: "Mapped Variants", value: formatNumber(details.mapped_variants as number), mono: true },
        { label: "Samples", value: formatNumber(details.sample_count as number), mono: true },
      ]} />
    </DetailSection>
  );
}

function PoseidonDetails({ details }: { details: Record<string, unknown> }) {
  const stats = details.stats as Record<string, unknown> | null;
  return (
    <DetailSection title="Poseidon ETL">
      <MetaGrid items={[
        { label: "Run Type", value: details.run_type as string },
        { label: "Dagster Run ID", value: details.dagster_run_id as string, mono: true },
      ]} />
      {stats && Object.keys(stats).length > 0 && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>Stats</div>
          <CodeBlock code={JSON.stringify(stats, null, 2)} language="json" />
        </div>
      )}
    </DetailSection>
  );
}

function CareGapDetails({ details }: { details: Record<string, unknown> }) {
  return (
    <DetailSection title="Care Gap Evaluation">
      <MetaGrid items={[
        { label: "Bundle", value: details.bundle_name as string },
        { label: "Person Count", value: formatNumber(details.person_count as number), mono: true },
        { label: "Cohort", value: details.cohort_definition as string },
      ]} />
      {!!details.compliance_summary && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="text-label" style={{ marginBottom: "var(--space-1)" }}>Compliance Summary</div>
          <CodeBlock code={JSON.stringify(details.compliance_summary, null, 2)} language="json" />
        </div>
      )}
    </DetailSection>
  );
}

function GisDetails({ details, type }: { details: Record<string, unknown>; type: string }) {
  const isBoundary = type === "gis_boundary";
  return (
    <DetailSection title={isBoundary ? "GIS Boundaries" : "GIS Import"}>
      <MetaGrid items={[
        ...(isBoundary ? [
          { label: "Dataset", value: details.dataset_name as string },
          { label: "Data Type", value: details.data_type as string },
          { label: "Source", value: details.source_name as string },
          { label: "Version", value: details.source_version as string },
        ] : [
          { label: "File", value: details.filename as string },
          { label: "File Size", value: formatBytes(details.file_size_bytes as number) },
        ]),
        { label: "Geometry", value: details.geometry_type as string },
        { label: "Features", value: formatNumber(details.feature_count as number), mono: true },
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
  return (
    <DetailSection title="Vocabulary Import">
      <MetaGrid items={[
        { label: "File", value: details.file_name as string },
        { label: "Version", value: details.vocabulary_version as string },
        { label: "Tables Loaded", value: formatNumber(details.tables_loaded as number), mono: true },
        { label: "Records Loaded", value: formatNumber(details.records_loaded as number), mono: true },
      ]} />
    </DetailSection>
  );
}

function FhirExportDetails({ details }: { details: Record<string, unknown> }) {
  const types = details.resource_types as string[] | null;
  return (
    <DetailSection title="FHIR Export">
      {types && types.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
          {types.map((t) => <Badge key={t} variant="default">{t}</Badge>)}
        </div>
      )}
      <MetaGrid items={[
        { label: "Output Format", value: details.output_format as string },
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
  const { data: job, isLoading, isError } = useJobDetail(jobId, jobType);

  return (
    <Drawer
      open={jobId != null}
      onClose={onClose}
      title={job?.name ?? "Job Details"}
      size="lg"
    >
      {isLoading && (
        <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)", margin: "0 auto" }} />
        </div>
      )}

      {isError && (
        <div style={{ padding: "var(--space-4)", textAlign: "center", color: "var(--text-muted)" }}>
          Failed to load job details.
        </div>
      )}

      {job && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Status header */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Badge variant={statusVariant(job.status)}>
              {job.status}
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
          <DetailSection title="Overview">
            <MetaGrid items={[
              { label: "Type", value: String(job.type).replace(/_/g, " ") },
              { label: "Source", value: job.source_name },
              { label: "Triggered By", value: job.triggered_by },
              { label: "Duration", value: formatDuration(job.started_at, job.completed_at), mono: true },
              { label: "Started", value: formatTimestamp(job.started_at) },
              { label: "Completed", value: formatTimestamp(job.completed_at) },
              { label: "Created", value: formatTimestamp(job.created_at) },
            ]} />
          </DetailSection>

          {/* Error message */}
          {job.error_message && (
            <div className="alert-card alert-critical">
              <XCircle size={16} className="alert-icon" />
              <div className="alert-content">
                <div className="alert-title">Error</div>
                <div className="alert-message">{job.error_message}</div>
              </div>
            </div>
          )}

          {/* Log output (brief) */}
          {job.log_output && (
            <DetailSection title="Output">
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
                <RefreshCw size={14} /> Retry
              </button>
            )}
            {job.actions.cancel && (
              <button className="btn btn-danger btn-sm" onClick={() => onCancel({ id: job.id, type: job.type })}>
                <Ban size={14} /> Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
