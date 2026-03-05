interface Props {
  dialect: string;
  onChange: (dialect: string) => void;
}

const DB_OPTIONS = [
  {
    id: "postgresql",
    name: "PostgreSQL",
    description: "Primary supported database",
    available: true,
    icon: (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <circle cx="16" cy="16" r="14" fill="#336791" />
        <path
          d="M22 10.5c-.7-2-2.5-3.5-5-3.5-1.2 0-2 .5-2.5.5S13 7 12 7C9.8 7 8 8.5 7.5 10.5c-.5 2 0 4 .5 5.5.5 1.5 1.5 2.5 2.5 2.5.7 0 1.2-.5 1.5-.5v4.5c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V18c.3 0 .8.5 1.5.5 1 0 2-1 2.5-2.5.5-1.5 1-3.5.5-5.5z"
          fill="white"
          opacity="0.85"
        />
      </svg>
    ),
  },
  {
    id: "oracle",
    name: "Oracle",
    description: "Enterprise relational database",
    available: true,
    icon: (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <rect width="32" height="32" rx="6" fill="#F80000" opacity="0.15" />
        <ellipse cx="16" cy="16" rx="11" ry="7" stroke="#F80000" strokeWidth="2.2" fill="none" />
        <ellipse cx="16" cy="16" rx="5.5" ry="3.5" fill="#F80000" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: "sqlserver",
    name: "SQL Server",
    description: "Microsoft SQL Server",
    available: true,
    icon: (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <rect width="32" height="32" rx="6" fill="#CC2927" opacity="0.15" />
        <rect x="7" y="10" width="18" height="3" rx="1.5" fill="#CC2927" opacity="0.7" />
        <rect x="7" y="14.5" width="18" height="3" rx="1.5" fill="#CC2927" opacity="0.5" />
        <rect x="7" y="19" width="12" height="3" rx="1.5" fill="#CC2927" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: "bigquery",
    name: "BigQuery",
    description: "Google Cloud data warehouse",
    available: false,
    icon: (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <rect width="32" height="32" rx="6" fill="#4285F4" opacity="0.12" />
        <path d="M16 7l9 15H7L16 7z" fill="#4285F4" opacity="0.5" />
        <circle cx="16" cy="19" r="3" fill="#4285F4" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: "redshift",
    name: "Redshift",
    description: "Amazon Web Services",
    available: false,
    icon: (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <rect width="32" height="32" rx="6" fill="#FF9900" opacity="0.12" />
        <polygon points="16,7 25,12 25,20 16,25 7,20 7,12" stroke="#FF9900" strokeWidth="1.8" fill="none" opacity="0.5" />
        <circle cx="16" cy="16" r="3" fill="#FF9900" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: "snowflake",
    name: "Snowflake",
    description: "Cloud data platform",
    available: false,
    icon: (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <rect width="32" height="32" rx="6" fill="#29B5E8" opacity="0.12" />
        <path d="M16 6v20M7 11l9 5 9-5M7 21l9-5 9 5" stroke="#29B5E8" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "databricks",
    name: "Databricks",
    description: "Unified data analytics",
    available: false,
    icon: (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <rect width="32" height="32" rx="6" fill="#FF3621" opacity="0.12" />
        <path d="M8 20l8-8 8 8" stroke="#FF3621" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        <path d="M8 14l8 4 8-4" stroke="#FF3621" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
      </svg>
    ),
  },
  {
    id: "spanner",
    name: "Cloud Spanner",
    description: "Google globally-distributed SQL",
    available: false,
    icon: (
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <rect width="32" height="32" rx="6" fill="#34A853" opacity="0.12" />
        <path d="M16 6v20M6 16h20" stroke="#34A853" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        <circle cx="16" cy="16" r="4" stroke="#34A853" strokeWidth="1.5" fill="none" opacity="0.4" />
      </svg>
    ),
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

      {/* Supported databases */}
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
                className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                  isSelected
                    ? "border-[#C9A227] bg-[#C9A227]/5 shadow-[0_0_0_1px_#C9A227]"
                    : "border-[#232328] bg-[#0E0E11] hover:border-[#323238] hover:bg-[#111114]"
                }`}
              >
                {db.icon}
                <div>
                  <p className="text-xs font-semibold text-[#F0EDE8]">{db.name}</p>
                  <p className="text-[10px] text-[#5A5650] mt-0.5">{db.description}</p>
                </div>
                {isSelected && (
                  <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A227]">
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none">
                      <path d="M2 5l2 2 4-4" stroke="#0E0E11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
              {db.icon}
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
