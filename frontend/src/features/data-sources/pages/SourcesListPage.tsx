import { useState } from "react";
import { Database, Shield, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSources } from "../hooks/useSources";
import { WebApiImportPanel } from "../components/WebApiImportPanel";
import { SourceAccessControl } from "../components/SourceAccessControl";
import { HelpButton } from "@/features/help";

export function SourcesListPage() {
  const { data: sources, isLoading, error } = useSources();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#8A857D]">Loading sources...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#E85A6B]">Failed to load sources</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Data Sources</h1>
          <p className="mt-1 text-sm text-[#8A857D]">
            Manage CDM database connections and access controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="data-sources" />
          <button
            type="button"
            onClick={() => setShowImport(!showImport)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              showImport
                ? "border-[#C9A227]/40 bg-[#C9A227]/10 text-[#C9A227]"
                : "border-[#232328] text-[#8A857D] hover:text-[#C5C0B8]",
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
            const isExpanded = expandedId === source.id;
            const isRestricted =
              source.restricted_to_roles && source.restricted_to_roles.length > 0;

            return (
              <div
                key={source.id}
                className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden"
              >
                {/* Source row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : source.id)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-[#1A1A1E] transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-[#5A5650] shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-[#5A5650] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
                    <div>
                      <span className="text-sm font-medium text-[#F0EDE8]">
                        {source.source_name}
                      </span>
                      {source.imported_from_webapi && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[#818CF8]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#818CF8]">
                          WebAPI
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-mono text-[#8A857D]">
                      {source.source_key}
                    </span>
                    <span className="text-sm text-[#8A857D]">
                      {source.source_dialect}
                    </span>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-xs text-[#5A5650]">
                        {source.daimons?.length ?? 0} daimons
                      </span>
                      {isRestricted && (
                        <Shield size={12} className="text-[#818CF8]" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-[#232328] px-4 py-4 space-y-4">
                    {/* Daimons */}
                    {source.daimons && source.daimons.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-[#8A857D] mb-2">
                          Daimons
                        </h4>
                        <div className="grid grid-cols-3 gap-2">
                          {source.daimons.map((d) => (
                            <div
                              key={d.id}
                              className="rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2"
                            >
                              <span className="text-xs font-medium text-[#C5C0B8] uppercase">
                                {d.daimon_type}
                              </span>
                              <p className="text-xs font-mono text-[#8A857D] mt-0.5">
                                {d.table_qualifier}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Connection */}
                    <div>
                      <h4 className="text-xs font-semibold text-[#8A857D] mb-1">
                        Connection
                      </h4>
                      <p className="text-xs font-mono text-[#5A5650] break-all">
                        {source.source_connection}
                      </p>
                    </div>

                    {/* Imported from */}
                    {source.imported_from_webapi && (
                      <div>
                        <h4 className="text-xs font-semibold text-[#8A857D] mb-1">
                          Imported From
                        </h4>
                        <p className="text-xs font-mono text-[#818CF8]">
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-12">
          <Database size={24} className="text-[#5A5650]" />
          <h3 className="mt-4 text-lg font-semibold text-[#F0EDE8]">
            No data sources
          </h3>
          <p className="mt-2 text-sm text-[#8A857D]">
            Get started by adding your first CDM data source or importing from a
            legacy WebAPI instance.
          </p>
        </div>
      )}
    </div>
  );
}
