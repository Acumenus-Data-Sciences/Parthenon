import { useState } from "react";
import { Database, Shield, Upload, ChevronDown, ChevronRight, Plus, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSources, useSetDefaultSource, useClearDefaultSource } from "../hooks/useSources";
import { WebApiImportPanel } from "../components/WebApiImportPanel";
import { SourceAccessControl } from "../components/SourceAccessControl";
import { HelpButton } from "@/features/help";
import { AddSourceWizard } from "../components/AddSourceWizard";
import { useAuthStore } from "@/stores/authStore";

export function SourcesListPage() {
  const { data: sources, isLoading, error } = useSources();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const setDefault = useSetDefaultSource();
  const clearDefault = useClearDefaultSource();
  const user = useAuthStore((s) => s.user);
  const userDefaultSourceId = user?.default_source_id ?? null;

  const handleToggleDefault = (sourceId: number, currentlyDefault: boolean) => {
    if (currentlyDefault) {
      clearDefault.mutate();
    } else {
      setDefault.mutate(sourceId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-muted">Loading sources...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-critical">Failed to load sources</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Clinical Data Models</h1>
          <p className="mt-1 text-sm text-text-muted">
            Manage CDM connections and set your default data model
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="data-sources" />
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-critical px-3 py-2 text-sm font-medium text-white hover:bg-critical transition-colors"
          >
            <Plus size={14} />
            Add Source
          </button>
          <button
            type="button"
            onClick={() => setShowImport(!showImport)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              showImport
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border-default text-text-muted hover:text-text-secondary",
            )}
          >
            <Upload size={14} />
            Import from WebAPI
          </button>
        </div>
      </div>

      {showImport && <WebApiImportPanel />}

      {sources && sources.length > 0 ? (
        <div className="space-y-2">
          {sources.map((source) => {
            const isExpanded = expandedIds.has(source.id);
            const isRestricted =
              source.restricted_to_roles && source.restricted_to_roles.length > 0;

            return (
              <div
                key={source.id}
                className="rounded-lg border border-border-default bg-surface-raised overflow-hidden"
              >
                {/* Source row */}
                <div className="flex items-center gap-3 w-full px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (isExpanded) next.delete(source.id); else next.add(source.id);
                      return next;
                    })}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-surface-overlay transition-colors rounded-md px-1 py-0.5"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-text-ghost shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="text-text-ghost shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {source.source_name}
                        </span>
                        {source.imported_from_webapi && (
                          <span className="inline-flex items-center rounded-full bg-info/10 px-1.5 py-0.5 text-[9px] font-medium text-info">
                            WebAPI
                          </span>
                        )}
                        {userDefaultSourceId === source.id && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium text-accent">
                            <Star size={8} className="fill-accent" />
                            My Default
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-mono text-text-muted">
                        {source.source_key}
                      </span>
                      <span className="text-sm text-text-muted">
                        {source.source_dialect}
                      </span>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-xs text-text-ghost">
                          {source.daimons?.length ?? 0} daimons
                        </span>
                        {isRestricted && (
                          <Shield size={12} className="text-info" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Per-user default CDM toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleDefault(source.id, userDefaultSourceId === source.id)}
                    title={userDefaultSourceId === source.id ? "Remove as your default CDM" : "Set as your default CDM"}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all border",
                      userDefaultSourceId === source.id
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border-default text-text-ghost hover:text-text-muted hover:border-surface-highlight hover:bg-surface-overlay",
                    )}
                  >
                    {/* Toggle track */}
                    <div
                      className={cn(
                        "relative w-7 h-4 rounded-full transition-colors",
                        userDefaultSourceId === source.id ? "bg-accent" : "bg-surface-highlight",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full transition-all",
                          userDefaultSourceId === source.id
                            ? "left-3.5 bg-surface-base"
                            : "left-0.5 bg-text-ghost",
                        )}
                      />
                    </div>
                    My Default
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border-default px-4 py-4 space-y-4">
                    {/* Daimons */}
                    {source.daimons && source.daimons.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-text-muted mb-2">
                          Daimons
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {source.daimons.map((d) => (
                            <div
                              key={d.id}
                              className="rounded-lg border border-border-default bg-surface-base px-3 py-2"
                            >
                              <span className="text-xs font-medium text-text-secondary uppercase">
                                {d.daimon_type}
                              </span>
                              <p className="text-xs font-mono text-text-muted mt-0.5">
                                {d.table_qualifier}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Connection */}
                    <div>
                      <h4 className="text-xs font-semibold text-text-muted mb-1">
                        Connection
                      </h4>
                      <p className="text-xs font-mono text-text-ghost break-all">
                        {source.source_connection}
                      </p>
                    </div>

                    {/* Imported from */}
                    {source.imported_from_webapi && (
                      <div>
                        <h4 className="text-xs font-semibold text-text-muted mb-1">
                          Imported From
                        </h4>
                        <p className="text-xs font-mono text-info">
                          {source.imported_from_webapi}
                        </p>
                      </div>
                    )}

                    {/* Access Control */}
                    <SourceAccessControl source={source} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12">
          <Database size={24} className="text-text-ghost" />
          <h3 className="mt-4 text-lg font-semibold text-text-primary">
            No data sources
          </h3>
          <p className="mt-2 text-sm text-text-muted">
            Get started by adding your first CDM data source or importing from a
            legacy WebAPI instance.
          </p>
        </div>
      )}

      {wizardOpen && <AddSourceWizard onClose={() => setWizardOpen(false)} />}
    </div>
  );
}
