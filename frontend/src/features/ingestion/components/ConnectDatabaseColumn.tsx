import { useState } from "react";
import { Database, Pencil, Unplug, Loader2 } from "lucide-react";
import type { IngestionProject, DbConnectionConfig, DbTableInfo } from "../api/ingestionApi";
import { useConnectDatabase, useConfirmTables, useStageDatabase } from "../hooks/useIngestionProjects";
import ConnectDatabaseModal from "./ConnectDatabaseModal";

interface ConnectDatabaseColumnProps {
  project: IngestionProject;
}

export default function ConnectDatabaseColumn({ project }: ConnectDatabaseColumnProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const connectMutation = useConnectDatabase(project.id);
  const confirmMutation = useConfirmTables(project.id);
  const stageMutation = useStageDatabase(project.id);

  const hasConnection = !!project.db_connection_config;
  const hasSelectedTables = (project.selected_tables ?? []).length > 0;
  const config = project.db_connection_config ?? null;

  const handleConnect = async (cfg: DbConnectionConfig): Promise<{ tables: DbTableInfo[] }> => {
    const result = await connectMutation.mutateAsync(cfg);
    return { tables: result.tables };
  };

  const handleConfirm = (_cfg: DbConnectionConfig, tables: string[]) => {
    confirmMutation.mutate(tables, {
      onSuccess: () => setModalOpen(false),
    });
  };

  const handleDisconnect = () => {
    confirmMutation.mutate([]);
  };

  const handleStageDb = () => {
    stageMutation.mutate();
  };

  if (hasConnection && hasSelectedTables) {
    const tables = project.selected_tables ?? [];
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-success">
          <Database size={14} />
          <span className="font-medium">
            {config?.dbms?.toUpperCase()} — {config?.host}/{config?.database} — {config?.schema}
          </span>
        </div>

        <div className="rounded-lg border border-border-default divide-y divide-[#1E1E23] max-h-48 overflow-y-auto">
          {tables.map((t) => (
            <div key={t} className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary">
              <Database size={12} className="text-text-ghost" />
              {t}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-highlight px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            <Pencil size={12} /> Change
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            className="inline-flex items-center gap-1.5 rounded-md border border-surface-highlight px-3 py-1.5 text-xs text-text-muted hover:text-critical transition-colors"
          >
            <Unplug size={12} /> Disconnect
          </button>
          <button
            type="button"
            onClick={handleStageDb}
            disabled={stageMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-text-primary hover:bg-primary-light disabled:opacity-40 transition-colors ml-auto"
          >
            {stageMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
            Profile & Stage
          </button>
        </div>

        {stageMutation.isError && (
          <p className="text-xs text-critical">
            {stageMutation.error instanceof Error ? stageMutation.error.message : "Staging failed"}
          </p>
        )}

        <ConnectDatabaseModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onConnect={handleConnect}
          onConfirm={handleConfirm}
          initialConfig={config}
          initialSelectedTables={project.selected_tables}
          isConnecting={connectMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mb-4">
        <Database size={24} className="text-success" />
      </div>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="rounded-lg bg-success/15 px-5 py-2.5 text-sm font-medium text-success hover:bg-success/25 transition-colors"
      >
        Connect to Database
      </button>
      <p className="mt-2 text-xs text-text-ghost">Connect to any supported database to browse and select tables</p>

      <ConnectDatabaseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnect={handleConnect}
        onConfirm={handleConfirm}
        initialConfig={null}
        initialSelectedTables={null}
        isConnecting={connectMutation.isPending}
      />
    </div>
  );
}
