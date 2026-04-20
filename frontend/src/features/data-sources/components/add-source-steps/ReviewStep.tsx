import { useTranslation } from "react-i18next";
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
    <div className="rounded-lg border border-border-default bg-surface-base p-4 space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</h4>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-text-ghost shrink-0">{label}</span>
      <span className={`text-right break-all ${mono ? "font-mono text-accent text-xs" : "text-text-secondary"}`}>
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
  const { t } = useTranslation("app");
  const daimonList = [
    { type: "cdm", qualifier: daimons.cdm },
    { type: "vocabulary", qualifier: daimons.vocabulary },
    { type: "results", qualifier: daimons.results },
    ...(daimons.temp ? [{ type: "temp", qualifier: daimons.temp }] : []),
  ];

  const connSummary = [
    c.db_host && { label: t("dataSources.common.hostIp"), value: c.db_host, mono: true },
    c.db_port && { label: t("dataSources.common.port"), value: c.db_port, mono: true },
    c.db_database && { label: t("dataSources.common.database"), value: c.db_database, mono: true },
    c.username && { label: t("dataSources.common.username"), value: c.username },
    c.password && { label: t("dataSources.common.password"), value: "••••••••" },
    c.source_connection && { label: t("dataSources.common.connection"), value: c.source_connection, mono: true },
    c.is_cache_enabled && {
      label: t("dataSources.wizard.connection.enableQueryCache"),
      value: t("dataSources.wizard.review.enabled"),
    },
    ...Object.entries(c.db_options)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ label: k, value: v })),
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          {t("dataSources.wizard.review.title")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("dataSources.wizard.review.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: summary */}
        <div className="space-y-3">
          <SummaryCard title={t("dataSources.common.database")}>
            <SummaryRow label={t("dataSources.common.type")} value={DIALECT_LABELS[dialect] ?? dialect} />
          </SummaryCard>

          <SummaryCard title={t("dataSources.common.identity")}>
            <SummaryRow label={t("dataSources.common.name")} value={c.source_name} />
            <SummaryRow label={t("dataSources.common.key")} value={c.source_key} mono />
          </SummaryCard>

          <SummaryCard title={t("dataSources.common.connection")}>
            {connSummary.map(({ label, value, mono }) => (
              <SummaryRow key={label} label={label} value={value} mono={mono} />
            ))}
          </SummaryCard>

          <SummaryCard title={t("dataSources.common.daimons")}>
            {daimonList.map(({ type, qualifier }) => {
              const Icon = DAIMON_ICONS[type as keyof typeof DAIMON_ICONS];
              return (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <Icon size={12} className="text-text-ghost shrink-0" />
                  <span className="text-text-ghost capitalize w-20 shrink-0">
                    {t(`dataSources.wizard.daimons.labels.${type}`)}
                  </span>
                  <span className="font-mono text-accent text-xs">{qualifier}</span>
                </div>
              );
            })}
          </SummaryCard>
        </div>

        {/* Right: what happens next */}
        <div className="rounded-lg border border-border-default bg-surface-base p-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t("dataSources.wizard.review.whatHappensNext")}
          </h4>
          <ul className="space-y-2">
            {[
              "dataSources.wizard.review.nextSteps.registered",
              "dataSources.wizard.review.nextSteps.routing",
              "dataSources.wizard.review.nextSteps.listed",
              "dataSources.wizard.review.nextSteps.explorer",
              "dataSources.wizard.review.nextSteps.achilles",
            ].map((itemKey, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-muted">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent font-semibold text-[9px]">
                  {i + 1}
                </span>
                {t(itemKey)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-light px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-critical disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading && <Loader2 size={14} className="animate-spin" />}
        {isLoading
          ? t("dataSources.wizard.review.addingSource")
          : t("dataSources.wizard.review.addSource")}
      </button>
    </div>
  );
}
