import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import apiClient from "@/lib/api-client";

export interface ConnectionData {
  source_name: string;
  source_key: string;
  source_connection: string;        // legacy named connection (optional)
  is_cache_enabled: boolean;
  // Dynamic fields
  db_host: string;
  db_port: string;
  db_database: string;
  username: string;
  password: string;
  db_options: Record<string, string>; // warehouse, role, account, sslmode, etc.
}

interface Props {
  dialect: string;
  data: ConnectionData;
  onChange: (data: ConnectionData) => void;
}

function toScreamingSnakeCase(str: string): string {
  return str
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ── Dialect-specific field config ─────────────────────────────────────────────

interface FieldDef {
  key: string;
  labelKey: string;
  placeholderValue: string;
  mono?: boolean;
  type?: "password" | "text" | "number";
  helperKey?: string;
  optionKey?: string; // maps into db_options instead of top-level field
  required?: boolean;
}

const DEFAULT_PORTS: Record<string, string> = {
  postgresql: "5432",
  redshift: "5439",
  oracle: "1521",
  sqlserver: "1433",
  synapse: "1433",
  snowflake: "443",
};

function getDialectFields(dialect: string): FieldDef[] {
  switch (dialect) {
    case "postgresql":
    case "redshift":
      return [
        { key: "db_host", labelKey: "dataSources.wizard.connection.fields.host", placeholderValue: "db.example.com", required: true },
        { key: "db_port", labelKey: "dataSources.wizard.connection.fields.port", placeholderValue: DEFAULT_PORTS[dialect] ?? "5432", type: "number", required: true },
        { key: "db_database", labelKey: "dataSources.wizard.connection.fields.database", placeholderValue: "ohdsi", required: true },
        { key: "username", labelKey: "dataSources.wizard.connection.fields.username", placeholderValue: "ohdsi_user", required: true },
        { key: "password", labelKey: "dataSources.wizard.connection.fields.password", placeholderValue: "••••••••", type: "password", required: true },
      ];

    case "oracle":
      return [
        { key: "db_host", labelKey: "dataSources.wizard.connection.fields.host", placeholderValue: "oracle.example.com", required: true },
        { key: "db_port", labelKey: "dataSources.wizard.connection.fields.port", placeholderValue: "1521", type: "number", required: true },
        { key: "db_database", labelKey: "dataSources.wizard.connection.fields.serviceNameSid", placeholderValue: "OHDSI", required: true },
        { key: "username", labelKey: "dataSources.wizard.connection.fields.username", placeholderValue: "ohdsi_user", required: true },
        { key: "password", labelKey: "dataSources.wizard.connection.fields.password", placeholderValue: "••••••••", type: "password", required: true },
      ];

    case "sqlserver":
    case "synapse":
      return [
        { key: "db_host", labelKey: "dataSources.wizard.connection.fields.host", placeholderValue: dialect === "synapse" ? "workspace.sql.azuresynapse.net" : "sqlserver.example.com", required: true },
        { key: "db_port", labelKey: "dataSources.wizard.connection.fields.port", placeholderValue: "1433", type: "number", required: true },
        { key: "db_database", labelKey: "dataSources.wizard.connection.fields.database", placeholderValue: "OHDSI", required: true },
        { key: "username", labelKey: "dataSources.wizard.connection.fields.username", placeholderValue: "ohdsi_user", required: true },
        { key: "password", labelKey: "dataSources.wizard.connection.fields.password", placeholderValue: "••••••••", type: "password", required: true },
      ];

    case "snowflake":
      return [
        { key: "db_host", labelKey: "dataSources.wizard.connection.fields.accountIdentifier", placeholderValue: "xy12345.us-east-1", optionKey: "account", required: true, helperKey: "dataSources.wizard.connection.helpers.snowflakeAccount" },
        { key: "db_database", labelKey: "dataSources.wizard.connection.fields.database", placeholderValue: "OHDSI", required: true },
        { key: "username", labelKey: "dataSources.wizard.connection.fields.username", placeholderValue: "ohdsi_user", required: true },
        { key: "password", labelKey: "dataSources.wizard.connection.fields.password", placeholderValue: "••••••••", type: "password", required: true },
        { key: "db_options.warehouse", labelKey: "dataSources.wizard.connection.fields.warehouse", placeholderValue: "COMPUTE_WH", optionKey: "warehouse", required: true },
        { key: "db_options.role", labelKey: "dataSources.wizard.connection.fields.role", placeholderValue: "OHDSI_ROLE", optionKey: "role", required: false },
      ];

    case "databricks":
      return [
        { key: "db_host", labelKey: "dataSources.wizard.connection.fields.serverHostname", placeholderValue: "adb-1234567890.7.azuredatabricks.net", required: true },
        { key: "db_database", labelKey: "dataSources.wizard.connection.fields.catalogDatabase", placeholderValue: "hive_metastore", required: true },
        { key: "db_options.http_path", labelKey: "dataSources.wizard.connection.fields.httpPath", placeholderValue: "/sql/1.0/warehouses/abc123", optionKey: "http_path", required: true, helperKey: "dataSources.wizard.connection.helpers.databricksHttpPath" },
        { key: "password", labelKey: "dataSources.wizard.connection.fields.personalAccessToken", placeholderValue: "dapi...", type: "password", required: true },
      ];

    case "duckdb":
      return [
        { key: "db_host", labelKey: "dataSources.wizard.connection.fields.databaseFilePath", placeholderValue: "/data/duckdb/eunomia.duckdb", required: true, helperKey: "dataSources.wizard.connection.helpers.duckdbPath" },
      ];

    case "bigquery":
      return [
        { key: "db_database", labelKey: "dataSources.wizard.connection.fields.gcpProjectId", placeholderValue: "my-project-123456", required: true },
        { key: "db_options.dataset", labelKey: "dataSources.wizard.connection.fields.defaultDataset", placeholderValue: "omop", optionKey: "dataset", required: true },
        { key: "db_options.location", labelKey: "dataSources.wizard.connection.fields.location", placeholderValue: "US", optionKey: "location", required: false, helperKey: "dataSources.wizard.connection.helpers.bigqueryLocation" },
        { key: "password", labelKey: "dataSources.wizard.connection.fields.serviceAccountJsonKeyPath", placeholderValue: "/secrets/sa-key.json", type: "password", required: true, helperKey: "dataSources.wizard.connection.helpers.serviceAccount" },
      ];

    case "mysql":
      return [
        { key: "db_host", labelKey: "dataSources.wizard.connection.fields.host", placeholderValue: "mysql.example.com", required: true },
        { key: "db_port", labelKey: "dataSources.wizard.connection.fields.port", placeholderValue: "3306", type: "number", required: true },
        { key: "db_database", labelKey: "dataSources.wizard.connection.fields.database", placeholderValue: "ohdsi", required: true },
        { key: "username", labelKey: "dataSources.wizard.connection.fields.username", placeholderValue: "ohdsi_user", required: true },
        { key: "password", labelKey: "dataSources.wizard.connection.fields.password", placeholderValue: "••••••••", type: "password", required: true },
      ];

    default:
      return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TestResult {
  success: boolean;
  latency_ms: number;
  error: string | null;
  note?: string;
}

export function ConnectionStep({ dialect, data, onChange }: Props) {
  const { t } = useTranslation("app");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const fields = getDialectFields(dialect);
  const isRProxy = ["databricks", "bigquery", "duckdb"].includes(dialect);

  function getFieldValue(f: FieldDef): string {
    if (f.optionKey) return data.db_options[f.optionKey] ?? "";
    return (data as unknown as Record<string, string>)[f.key] ?? "";
  }

  function setFieldValue(f: FieldDef, value: string) {
    if (f.optionKey) {
      onChange({ ...data, db_options: { ...data.db_options, [f.optionKey]: value } });
    } else {
      onChange({ ...data, [f.key]: value });
    }
  }

  function handleNameChange(name: string) {
    const update = { ...data, source_name: name };
    if (!keyManuallyEdited) update.source_key = toScreamingSnakeCase(name);
    onChange(update);
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const payload = {
        source_name: data.source_name || "test",
        source_key: data.source_key || "TEST",
        source_dialect: dialect,
        db_host: data.db_host || undefined,
        db_port: data.db_port ? parseInt(data.db_port) : undefined,
        db_database: data.db_database || undefined,
        username: data.username || undefined,
        password: data.password || undefined,
        db_options: Object.keys(data.db_options).length ? data.db_options : undefined,
      };
      const { data: res } = await apiClient.post<TestResult>("/sources/test-connection", payload);
      setTestResult(res);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setTestResult({
        success: false,
        latency_ms: 0,
        error: e?.response?.data?.error ?? t("dataSources.wizard.connection.connectionFailed"),
      });
    } finally {
      setTesting(false);
    }
  }

  const canTest = dialect && data.db_host && (isRProxy || (data.username && data.password));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          {t("dataSources.wizard.connection.title")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("dataSources.wizard.connection.subtitle")}
        </p>
      </div>

      {/* Source Name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-secondary">
          {t("dataSources.wizard.connection.sourceName")}{" "}
          <span className="text-critical">*</span>
        </label>
        <input
          type="text"
          value={data.source_name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={t("dataSources.wizard.connection.sourceNamePlaceholder")}
          className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
        />
      </div>

      {/* Source Key */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-text-secondary">
          {t("dataSources.wizard.connection.sourceKey")}{" "}
          <span className="text-critical">*</span>
        </label>
        <input
          type="text"
          value={data.source_key}
          onChange={(e) => {
            setKeyManuallyEdited(true);
            onChange({ ...data, source_key: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") });
          }}
          placeholder="ACUMENUS_PROD"
          className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 font-mono text-sm text-accent placeholder:text-text-ghost focus:border-accent focus:outline-none"
        />
        <p className="flex items-center gap-1 text-xs text-text-ghost">
          <Info size={10} />
          {t("dataSources.wizard.connection.sourceKeyHelp")}
        </p>
      </div>

      {/* Dialect-specific connection fields */}
      {fields.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-base p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-ghost">
            {t("dataSources.wizard.connection.connectionLabel", {
              dialect: dialect.charAt(0).toUpperCase() + dialect.slice(1),
            })}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className={`space-y-1 ${f.key === "db_host" || f.key.includes("path") || f.key.includes("hostname") ? "col-span-2" : ""}`}>
                <label className="block text-xs font-medium text-text-secondary">
                  {t(f.labelKey)}
                  {f.required && <span className="ml-0.5 text-critical">*</span>}
                </label>
                <input
                  type={f.type ?? "text"}
                  value={getFieldValue(f)}
                  onChange={(e) => setFieldValue(f, e.target.value)}
                  placeholder={f.placeholderValue}
                  className={`w-full rounded-md border border-border-default bg-surface-raised px-3 py-1.5 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none ${f.mono ? "font-mono" : ""}`}
                />
                {f.helperKey && (
                  <p className="flex items-start gap-1 text-[10px] text-text-ghost leading-tight">
                    <Info size={9} className="mt-0.5 shrink-0" />
                    {t(f.helperKey)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Test Connection */}
          <div className="pt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={runTest}
              disabled={testing || !canTest}
              className="flex items-center gap-1.5 rounded-md border border-surface-highlight px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {testing && <Loader2 size={11} className="animate-spin" />}
              {t("dataSources.actions.testConnection")}
            </button>
            {testResult && (
              <div className={`flex items-center gap-1.5 text-xs ${testResult.success ? "text-success" : "text-critical"}`}>
                {testResult.success
                  ? <CheckCircle2 size={12} />
                  : <XCircle size={12} />}
                {testResult.success
                  ? testResult.note
                    ? t("dataSources.wizard.connection.rServiceVerified")
                    : t("dataSources.wizard.connection.connected", {
                        latency: testResult.latency_ms,
                      })
                  : testResult.error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legacy named connection — only shown when no db_host-based approach */}
      {fields.length === 0 && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-text-secondary">
            {t("dataSources.wizard.connection.laravelConnectionName")}
          </label>
          <input
            type="text"
            value={data.source_connection}
            onChange={(e) => onChange({ ...data, source_connection: e.target.value })}
            placeholder="cdm"
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
          />
        </div>
      )}

      {/* Cache toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface-base px-4 py-3">
        <div>
          <p className="text-sm font-medium text-text-secondary">
            {t("dataSources.wizard.connection.enableQueryCache")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("dataSources.wizard.connection.queryCacheHelp")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...data, is_cache_enabled: !data.is_cache_enabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ${data.is_cache_enabled ? "border-accent bg-accent" : "border-surface-highlight bg-surface-highlight"}`}
        >
          <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${data.is_cache_enabled ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>
    </div>
  );
}
