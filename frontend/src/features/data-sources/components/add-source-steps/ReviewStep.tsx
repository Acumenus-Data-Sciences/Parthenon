import { Loader2, Database, BookOpen, BarChart2, Clock } from "lucide-react";
import type { ConnectionData } from "./ConnectionStep";
import type { DaimonsData } from "./DaimonsStep";

interface Props {
  dialect: string;
  connection: ConnectionData;
  daimons: DaimonsData;
  onSubmit: () => void;
  isLoading: boolean;
  error: string | null;
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">{title}</h4>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-[#5A5650] shrink-0">{label}</span>
      <span className={`text-right break-all ${mono ? "font-mono text-[#C9A227] text-xs" : "text-[#C5C0B8]"}`}>
        {value}
      </span>
    </div>
  );
}

const DAIMON_ICONS = {
  cdm: Database,
  vocabulary: BookOpen,
  results: BarChart2,
  temp: Clock,
};

const DIALECT_LABELS: Record<string, string> = {
  postgresql: "PostgreSQL",
  redshift: "Amazon Redshift",
  oracle: "Oracle",
  sqlserver: "SQL Server",
  synapse: "Azure Synapse",
  snowflake: "Snowflake",
  databricks: "Databricks",
  bigquery: "Google BigQuery",
  duckdb: "DuckDB",
  mysql: "MySQL",
};

export function ReviewStep({ dialect, connection: c, daimons, onSubmit, isLoading, error }: Props) {
  const daimonList = [
    { type: "cdm", qualifier: daimons.cdm },
    { type: "vocabulary", qualifier: daimons.vocabulary },
    { type: "results", qualifier: daimons.results },
    ...(daimons.temp ? [{ type: "temp", qualifier: daimons.temp }] : []),
  ];

  const connSummary = [
    c.db_host && { label: "Host", value: c.db_host },
    c.db_port && { label: "Port", value: c.db_port },
    c.db_database && { label: "Database", value: c.db_database },
    c.username && { label: "Username", value: c.username },
    c.password && { label: "Password", value: "••••••••" },
    c.source_connection && { label: "Connection", value: c.source_connection },
    c.is_cache_enabled && { label: "Query cache", value: "Enabled" },
    ...Object.entries(c.db_options)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ label: k, value: v })),
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#F0EDE8]">Review & Add Source</h2>
        <p className="mt-1 text-sm text-[#8A857D]">
          Confirm the settings below, then click Add Source.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: summary */}
        <div className="space-y-3">
          <SummaryCard title="Database">
            <SummaryRow label="Type" value={DIALECT_LABELS[dialect] ?? dialect} />
          </SummaryCard>

          <SummaryCard title="Identity">
            <SummaryRow label="Name" value={c.source_name} />
            <SummaryRow label="Key" value={c.source_key} mono />
          </SummaryCard>

          <SummaryCard title="Connection">
            {connSummary.map(({ label, value }) => (
              <SummaryRow key={label} label={label} value={value} mono={["Host", "Port", "Database", "Connection"].includes(label)} />
            ))}
          </SummaryCard>

          <SummaryCard title="Daimons">
            {daimonList.map(({ type, qualifier }) => {
              const Icon = DAIMON_ICONS[type as keyof typeof DAIMON_ICONS];
              return (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <Icon size={12} className="text-[#5A5650] shrink-0" />
                  <span className="text-[#5A5650] capitalize w-20 shrink-0">{type}</span>
                  <span className="font-mono text-[#C9A227] text-xs">{qualifier}</span>
                </div>
              );
            })}
          </SummaryCard>
        </div>

        {/* Right: what happens next */}
        <div className="rounded-lg border border-[#232328] bg-[#0E0E11] p-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">What happens next</h4>
          <ul className="space-y-2">
            {[
              "Source is registered in the Parthenon database",
              "Daimon schema qualifiers stored for query routing",
              "Source appears in the Data Sources list immediately",
              "Users with access can select it in Data Explorer",
              "Run Achilles in the R service to populate characterization data",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#8A857D]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#C9A227]/10 text-[#C9A227] font-semibold text-[9px]">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/10 px-4 py-3 text-sm text-[#E85A6B]">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C9353F] px-4 py-3 text-sm font-semibold text-text-primary hover:bg-[#D94550] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading && <Loader2 size={14} className="animate-spin" />}
        {isLoading ? "Adding Source…" : "Add Source"}
      </button>
    </div>
  );
}
