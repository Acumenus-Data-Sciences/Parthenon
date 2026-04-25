import { AlertOctagon, AlertTriangle, Info, Loader2, X } from "lucide-react";
import { useMeasureMethodology } from "../hooks";
import type { DataQualityFlag } from "../types";
import { MeasureTrendChart } from "./MeasureTrendChart";

interface Props {
  bundleId: number | null;
  measureId: number | null;
  sourceId: number | null;
  onClose: () => void;
}

export function MeasureMethodologyModal({
  bundleId,
  measureId,
  sourceId,
  onClose,
}: Props) {
  const { data, isLoading, error } = useMeasureMethodology(
    bundleId,
    measureId,
    sourceId,
  );

  if (bundleId == null || measureId == null || sourceId == null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl border border-border-default bg-surface-base shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-border-default bg-surface-raised px-6 py-3">
          <div>
            <h2 className="text-base font-bold text-text-primary">
              Methodology · {data?.measure.measure_code ?? "…"}
            </h2>
            <p className="mt-0.5 text-xs text-text-ghost">
              {data?.measure.measure_name ?? ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-ghost transition-colors hover:bg-surface-overlay hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5 text-sm">
          {isLoading && (
            <div className="flex items-center gap-2 text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading methodology…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-red-200">
              Failed to load methodology.
            </div>
          )}

          {data && (
            <>
              <DqSection flags={data.data_quality_flags} />

              <Section title="Trend">
                <MeasureTrendChart
                  bundleId={bundleId}
                  measureId={measureId}
                  sourceId={sourceId}
                />
              </Section>

              <Section title="Bundle qualification">
                <Field label="Bundle">
                  {data.bundle.condition_name}{" "}
                  <span className="text-xs text-text-ghost">
                    ({data.bundle.bundle_code})
                  </span>
                </Field>
                <Field label="Domain">
                  {data.bundle.qualification.domain}
                </Field>
                <Field label="Total descendants matched">
                  {data.bundle.qualification.total_descendants.toLocaleString()}
                </Field>
                <ConceptList concepts={data.bundle.qualification.concepts} />
              </Section>

              <Section title="Numerator criteria">
                <Field label="Domain">{data.measure.domain}</Field>
                <Field label="Lookback window">
                  {data.measure.numerator.lookback_days} days from CDM max date
                </Field>
                <Field label="Total descendants">
                  {data.measure.numerator.total_descendants.toLocaleString()}
                </Field>
                <ConceptList concepts={data.measure.numerator.concepts} />
              </Section>

              {data.measure.exclusions.length > 0 && (
                <Section title="Denominator exclusions">
                  {data.measure.exclusions.map((ex, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border-default bg-surface-raised p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-text-primary">
                          {ex.label}
                        </div>
                        <div className="text-xs text-text-ghost">
                          {ex.domain} · lookback {ex.lookback_days}d
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-text-ghost">
                        {ex.total_descendants.toLocaleString()} descendant concepts
                        {ex.vsac_oid && (
                          <>
                            {" · VSAC OID "}
                            <span className="font-mono">{ex.vsac_oid}</span>
                          </>
                        )}
                      </div>
                      <ConceptList concepts={ex.concepts} compact />
                    </div>
                  ))}
                </Section>
              )}

              <Section title="Source provenance">
                <Field label="Source">{data.source.source_name}</Field>
                <Field label="CDM schema">
                  <code className="font-mono text-xs">{data.source.cdm_schema}</code>
                </Field>
                {Object.entries(data.source.cdm_max_dates).map(([table, date]) => (
                  <Field key={table} label={`max(${table})`}>
                    {date ?? "—"}
                  </Field>
                ))}
              </Section>

              {data.run && (
                <Section title="Run pointer (current)">
                  <Field label="Run id">#{data.run.id}</Field>
                  <Field label="Status">{data.run.status}</Field>
                  <Field label="Triggered">{data.run.trigger_kind}</Field>
                  <Field label="Started">{data.run.started_at ?? "—"}</Field>
                  <Field label="Completed">{data.run.completed_at ?? "—"}</Field>
                  <Field label="Bundle version">
                    {data.run.bundle_version ?? "—"}
                  </Field>
                  <Field label="CDM fingerprint">
                    <code className="break-all font-mono text-[10px]">
                      {data.run.cdm_fingerprint ?? "—"}
                    </code>
                  </Field>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-ghost">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[12rem_1fr] gap-2 text-xs">
      <div className="text-text-ghost">{label}</div>
      <div className="text-text-primary">{children}</div>
    </div>
  );
}

function ConceptList({
  concepts,
  compact = false,
}: {
  concepts: Array<{
    concept_id: number;
    concept_name: string;
    vocabulary_id: string;
    descendant_count: number;
  }>;
  compact?: boolean;
}) {
  if (concepts.length === 0) {
    return <p className="text-xs text-text-ghost">No concepts.</p>;
  }
  return (
    <ul
      className={`mt-2 divide-y divide-border-default/40 rounded border border-border-default ${compact ? "text-[11px]" : "text-xs"}`}
    >
      {concepts.map((c) => (
        <li
          key={c.concept_id}
          className="grid grid-cols-[7rem_1fr_5rem_5rem] items-center gap-2 px-3 py-1.5"
        >
          <span className="font-mono text-text-ghost">{c.concept_id}</span>
          <span className="truncate text-text-primary">{c.concept_name}</span>
          <span className="text-text-muted">{c.vocabulary_id}</span>
          <span className="text-right text-text-ghost">
            {c.descendant_count.toLocaleString()} desc.
          </span>
        </li>
      ))}
    </ul>
  );
}

function DqSection({ flags }: { flags: DataQualityFlag[] }) {
  if (flags.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-teal-900/60 bg-teal-950/30 p-3 text-xs text-teal-200">
        <Info className="h-4 w-4 shrink-0" />
        No data-quality flags raised for this measure on this source.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {flags.map((f, i) => (
        <DqFlagRow key={i} flag={f} />
      ))}
    </div>
  );
}

function DqFlagRow({ flag }: { flag: DataQualityFlag }) {
  const tone = {
    info: {
      cls: "border-sky-900/60 bg-sky-950/30 text-sky-200",
      Icon: Info,
    },
    warning: {
      cls: "border-amber-900/60 bg-amber-950/30 text-amber-200",
      Icon: AlertTriangle,
    },
    critical: {
      cls: "border-red-900/60 bg-red-950/30 text-red-200",
      Icon: AlertOctagon,
    },
  }[flag.level];

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 text-xs ${tone.cls}`}>
      <tone.Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold uppercase tracking-wide">
          {flag.level} · {flag.code}
        </div>
        <div className="mt-1 opacity-90">{flag.message}</div>
      </div>
    </div>
  );
}
