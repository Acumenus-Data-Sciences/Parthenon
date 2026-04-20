import { useTranslation } from "react-i18next";
import postgresqlIcon from "./icons/postgresql.svg";
import oracleIcon from "./icons/oracle.svg";
import sqlserverIcon from "./icons/sqlserver.svg";
import bigqueryIcon from "./icons/bigquery.svg";
import redshiftIcon from "./icons/redshift.svg";
import snowflakeIcon from "./icons/snowflake.svg";
import databricksIcon from "./icons/databricks.svg";
import spannerIcon from "./icons/spanner.svg";

interface Props {
  dialect: string;
  onChange: (dialect: string) => void;
}

// Brand colours from each logo
const DB_OPTIONS = [
  {
    id: "postgresql",
    displayName: "PostgreSQL",
    descriptionKey: "dataSources.wizard.database.descriptions.postgresql",
    available: true,
    icon: postgresqlIcon,
    color: "#336791",
  },
  {
    id: "oracle",
    displayName: "Oracle",
    descriptionKey: "dataSources.wizard.database.descriptions.oracle",
    available: true,
    icon: oracleIcon,
    color: "#F80000",
  },
  {
    id: "sqlserver",
    displayName: "SQL Server",
    descriptionKey: "dataSources.wizard.database.descriptions.sqlserver",
    available: true,
    icon: sqlserverIcon,
    color: "#CC2927",
  },
  {
    id: "bigquery",
    displayName: "BigQuery",
    descriptionKey: "dataSources.wizard.database.descriptions.bigquery",
    available: false,
    icon: bigqueryIcon,
    color: "#4285F4",
  },
  {
    id: "redshift",
    displayName: "Redshift",
    descriptionKey: "dataSources.wizard.database.descriptions.redshift",
    available: false,
    icon: redshiftIcon,
    color: "#8C4FFF",
  },
  {
    id: "snowflake",
    displayName: "Snowflake",
    descriptionKey: "dataSources.wizard.database.descriptions.snowflake",
    available: false,
    icon: snowflakeIcon,
    color: "#29B5E8",
  },
  {
    id: "databricks",
    displayName: "Databricks",
    descriptionKey: "dataSources.wizard.database.descriptions.databricks",
    available: false,
    icon: databricksIcon,
    color: "#FF3621",
  },
  {
    id: "spanner",
    displayName: "Cloud Spanner",
    descriptionKey: "dataSources.wizard.database.descriptions.spanner",
    available: false,
    icon: spannerIcon,
    color: "#4285F4",
  },
];

export function DatabaseStep({ dialect, onChange }: Props) {
  const { t } = useTranslation("app");
  const available = DB_OPTIONS.filter((d) => d.available);
  const comingSoon = DB_OPTIONS.filter((d) => !d.available);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          {t("dataSources.wizard.database.title")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("dataSources.wizard.database.subtitle")}
        </p>
      </div>

      {/* Supported */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
          {t("dataSources.wizard.database.supported")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {available.map((db) => {
            const isSelected = dialect === db.id;
            return (
              <button
                key={db.id}
                type="button"
                onClick={() => onChange(db.id)}
                className={`relative flex flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-all ${
                  isSelected
                    ? "border-accent bg-accent/5 shadow-[0_0_0_1px_#C9A227]"
                    : "border-border-default bg-surface-base hover:border-surface-highlight hover:bg-surface-base"
                }`}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${db.color}18` }}
                >
                  <img
                    src={db.icon}
                    alt={db.displayName}
                    className="h-6 w-6"
                    style={{ filter: `drop-shadow(0 0 4px ${db.color}60)` }}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-primary">
                    {db.displayName}
                  </p>
                  <p className="text-[10px] text-text-ghost mt-0.5">
                    {t(db.descriptionKey)}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
                      <path
                        d="M2 5l2 2 4-4"
                        stroke="var(--surface-base)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Coming soon */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
          {t("dataSources.wizard.database.comingSoon")}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {comingSoon.map((db) => (
            <div
              key={db.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-border-subtle bg-surface-darkest p-3 text-center opacity-40 cursor-not-allowed select-none"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md"
                style={{ backgroundColor: `${db.color}15` }}
              >
                <img src={db.icon} alt={db.displayName} className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">
                  {db.displayName}
                </p>
                <span className="mt-0.5 inline-block rounded-full bg-surface-elevated px-1.5 py-0.5 text-[9px] font-medium text-text-muted">
                  {t("dataSources.wizard.database.comingSoonShort")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
