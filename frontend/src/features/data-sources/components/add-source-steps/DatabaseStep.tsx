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
    name: "PostgreSQL",
    description: "Primary supported database",
    available: true,
    icon: postgresqlIcon,
    color: "#336791",
  },
  {
    id: "oracle",
    name: "Oracle",
    description: "Enterprise relational database",
    available: true,
    icon: oracleIcon,
    color: "#F80000",
  },
  {
    id: "sqlserver",
    name: "SQL Server",
    description: "Microsoft SQL Server",
    available: true,
    icon: sqlserverIcon,
    color: "#CC2927",
  },
  {
    id: "bigquery",
    name: "BigQuery",
    description: "Google Cloud data warehouse",
    available: false,
    icon: bigqueryIcon,
    color: "#4285F4",
  },
  {
    id: "redshift",
    name: "Redshift",
    description: "Amazon Web Services",
    available: false,
    icon: redshiftIcon,
    color: "#8C4FFF",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    description: "Cloud data platform",
    available: false,
    icon: snowflakeIcon,
    color: "#29B5E8",
  },
  {
    id: "databricks",
    name: "Databricks",
    description: "Unified data analytics",
    available: false,
    icon: databricksIcon,
    color: "#FF3621",
  },
  {
    id: "spanner",
    name: "Cloud Spanner",
    description: "Google globally-distributed SQL",
    available: false,
    icon: spannerIcon,
    color: "#4285F4",
  },
];

export function DatabaseStep({ dialect, onChange }: Props) {
  const available = DB_OPTIONS.filter((d) => d.available);
  const comingSoon = DB_OPTIONS.filter((d) => !d.available);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#F0EDE8]">Choose Database Type</h2>
        <p className="mt-1 text-sm text-[#8A857D]">
          Select the database engine your CDM is hosted on.
        </p>
      </div>

      {/* Supported */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">Supported</p>
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
                    ? "border-[#C9A227] bg-[#C9A227]/5 shadow-[0_0_0_1px_#C9A227]"
                    : "border-[#232328] bg-[#0E0E11] hover:border-[#323238] hover:bg-[#111114]"
                }`}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${db.color}18` }}
                >
                  <img
                    src={db.icon}
                    alt={db.name}
                    className="h-6 w-6"
                    style={{ filter: `drop-shadow(0 0 4px ${db.color}60)` }}
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F0EDE8]">{db.name}</p>
                  <p className="text-[10px] text-[#5A5650] mt-0.5">{db.description}</p>
                </div>
                {isSelected && (
                  <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A227]">
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
                      <path
                        d="M2 5l2 2 4-4"
                        stroke="#0E0E11"
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
        <p className="text-xs font-semibold uppercase tracking-wider text-[#5A5650]">Coming Soon</p>
        <div className="grid grid-cols-4 gap-2">
          {comingSoon.map((db) => (
            <div
              key={db.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-[#1E1E22] bg-[#0A0A0C] p-3 text-center opacity-40 cursor-not-allowed select-none"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md"
                style={{ backgroundColor: `${db.color}15` }}
              >
                <img src={db.icon} alt={db.name} className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#F0EDE8]">{db.name}</p>
                <span className="mt-0.5 inline-block rounded-full bg-[#232328] px-1.5 py-0.5 text-[9px] font-medium text-[#8A857D]">
                  Coming soon
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
