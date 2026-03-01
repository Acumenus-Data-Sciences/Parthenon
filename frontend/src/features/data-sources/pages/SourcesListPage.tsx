import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "../api/sourcesApi";
import { Database } from "lucide-react";

export function SourcesListPage() {
  const { data: sources, isLoading, error } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading sources...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Failed to load sources</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Sources</h1>
          <p className="mt-1 text-muted-foreground">
            Manage CDM database connections
          </p>
        </div>
      </div>

      {sources && sources.length > 0 ? (
        <div className="rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Dialect
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Daimons
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr
                  key={source.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 text-sm">{source.source_name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                    {source.source_key}
                  </td>
                  <td className="px-4 py-3 text-sm">{source.source_dialect}</td>
                  <td className="px-4 py-3 text-sm">
                    {source.daimons?.length ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <Database className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No data sources
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by adding your first CDM data source.
          </p>
        </div>
      )}
    </div>
  );
}
