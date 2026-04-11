import { useState, useEffect } from "react";
import { X, Loader2, Database, CheckCircle2, AlertTriangle } from "lucide-react";
import type { DbConnectionConfig, DbTableInfo } from "../api/ingestionApi";

const DIALECT_OPTIONS = [
  { value: "postgresql", label: "PostgreSQL", defaultPort: 5432 },
  { value: "sql server", label: "SQL Server", defaultPort: 1433 },
  { value: "oracle", label: "Oracle", defaultPort: 1521 },
  { value: "mysql", label: "MySQL", defaultPort: 3306 },
  { value: "mariadb", label: "MariaDB", defaultPort: 3306 },
  { value: "bigquery", label: "BigQuery", defaultPort: 443 },
  { value: "redshift", label: "Redshift", defaultPort: 5439 },
  { value: "snowflake", label: "Snowflake", defaultPort: 443 },
  { value: "spark", label: "Spark / Databricks", defaultPort: 443 },
  { value: "duckdb", label: "DuckDB", defaultPort: 0 },
  { value: "sqlite", label: "SQLite", defaultPort: 0 },
  { value: "synapse", label: "Synapse", defaultPort: 1433 },
] as const;

interface ConnectDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: DbConnectionConfig) => Promise<{ tables: DbTableInfo[] }>;
  onConfirm: (config: DbConnectionConfig, tables: string[]) => void;
  initialConfig?: DbConnectionConfig | null;
  initialSelectedTables?: string[] | null;
  isConnecting: boolean;
}

export default function ConnectDatabaseModal({
  isOpen,
  onClose,
  onConnect,
  onConfirm,
  initialConfig,
  initialSelectedTables,
  isConnecting,
}: ConnectDatabaseModalProps) {
  const [dbms, setDbms] = useState(initialConfig?.dbms ?? "postgresql");
  const [host, setHost] = useState(initialConfig?.host ?? "");
  const [port, setPort] = useState(initialConfig?.port ?? 5432);
  const [user, setUser] = useState(initialConfig?.user ?? "");
  const [password, setPassword] = useState(initialConfig?.password ?? "");
  const [database, setDatabase] = useState(initialConfig?.database ?? "");
  const [schema, setSchema] = useState(initialConfig?.schema ?? "");

  const [tables, setTables] = useState<DbTableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    new Set(initialSelectedTables ?? []),
  );
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialConfig) {
      setDbms(initialConfig.dbms);
      setHost(initialConfig.host);
      setPort(initialConfig.port);
      setUser(initialConfig.user);
      setPassword(initialConfig.password);
      setDatabase(initialConfig.database);
      setSchema(initialConfig.schema);
      setSelectedTables(new Set(initialSelectedTables ?? []));
    }
  }, [isOpen, initialConfig, initialSelectedTables]);

  const handleDialectChange = (value: string) => {
    setDbms(value);
    const dialect = DIALECT_OPTIONS.find((d) => d.value === value);
    if (dialect) setPort(dialect.defaultPort);
    setConnected(false);
    setTables([]);
  };

  const handleTestConnection = async () => {
    setError(null);
    try {
      const config: DbConnectionConfig = { dbms, host, port, user, password, database, schema };
      const result = await onConnect(config);
      setTables(result.tables);
      setConnected(true);
      setSelectedTables(new Set(result.tables.map((t) => t.name)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setConnected(false);
      setTables([]);
    }
  };

  const handleToggleTable = (name: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTables.size === tables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(tables.map((t) => t.name)));
    }
  };

  const handleConfirm = () => {
    const config: DbConnectionConfig = { dbms, host, port, user, password, database, schema };
    onConfirm(config, Array.from(selectedTables));
  };

  if (!isOpen) return null;

  const inputCls =
    "w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary placeholder-text-ghost focus:border-success/50 focus:outline-none focus:ring-1 focus:ring-success/30";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-xl border border-border-default bg-surface-raised shadow-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
            <div className="flex items-center gap-3">
              <Database size={20} className="text-success" />
              <h2 className="text-lg font-semibold text-text-primary">Connect to Database</h2>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-text-ghost hover:text-text-primary">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-text-muted mb-1">Database Type</label>
                <select className={inputCls} value={dbms} onChange={(e) => handleDialectChange(e.target.value)}>
                  {DIALECT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Host / IP</label>
                <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Port</label>
                <input className={inputCls} type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Username</label>
                <input className={inputCls} value={user} onChange={(e) => setUser(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Password</label>
                <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Database</label>
                <input className={inputCls} value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="parthenon" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Schema</label>
                <input className={inputCls} value={schema} onChange={(e) => setSchema(e.target.value)} placeholder="public" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={!host || !database || !schema || isConnecting}
                className="inline-flex items-center gap-2 rounded-lg bg-success/15 px-4 py-2 text-sm font-medium text-success hover:bg-success/25 disabled:opacity-40 transition-colors"
              >
                {isConnecting ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                Test Connection
              </button>
              {connected && (
                <span className="flex items-center gap-1 text-sm text-success">
                  <CheckCircle2 size={14} /> Connected — {tables.length} tables found
                </span>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-critical/10 border border-critical/30 px-3 py-2">
                <AlertTriangle size={14} className="text-critical mt-0.5 shrink-0" />
                <p className="text-sm text-critical">{error}</p>
              </div>
            )}

            {connected && tables.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-muted">
                    Select Tables ({selectedTables.size} / {tables.length})
                  </span>
                  <button type="button" onClick={handleSelectAll} className="text-xs text-success hover:text-success/80">
                    {selectedTables.size === tables.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-border-default divide-y divide-[#1E1E23]">
                  {tables.map((t) => (
                    <label key={t.name} className="flex items-center gap-3 px-3 py-2 hover:bg-surface-overlay cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedTables.has(t.name)}
                        onChange={() => handleToggleTable(t.name)}
                        className="rounded border-surface-highlight bg-surface-base text-success focus:ring-success/30"
                      />
                      <span className="text-sm text-text-primary flex-1">{t.name}</span>
                      <span className="text-xs text-text-ghost font-mono">
                        {t.column_count} cols
                        {t.row_count != null && ` · ${t.row_count.toLocaleString()} rows`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-default">
            <button type="button" onClick={onClose} className="rounded-lg border border-surface-highlight px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedTables.size === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-primary hover:bg-primary-light disabled:opacity-40 transition-colors"
            >
              Confirm ({selectedTables.size} tables)
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
