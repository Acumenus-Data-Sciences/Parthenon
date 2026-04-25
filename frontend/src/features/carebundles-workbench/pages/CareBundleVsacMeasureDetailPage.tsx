import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { HelpButton } from "@/features/help";
import { useVsacMeasure } from "../hooks";
import { WorkbenchTabs } from "../components/WorkbenchTabs";

export default function CareBundleVsacMeasureDetailPage() {
  const { cms_id: cmsIdParam } = useParams<{ cms_id: string }>();
  const cmsId = cmsIdParam ?? null;

  const { data, isLoading } = useVsacMeasure(cmsId);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <WorkbenchTabs />

      <Link
        to="/workbench/care-bundles/measures"
        className="inline-flex items-center gap-1 text-xs text-text-ghost hover:text-text-primary"
      >
        <ArrowLeft className="h-3 w-3" /> CMS Measures
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {cmsId ?? "…"}
          </h1>
          <p className="mt-1 text-sm text-text-ghost">
            {data?.measure.cbe_number && data.measure.cbe_number !== "Not Applicable"
              ? `CBE ${data.measure.cbe_number} · `
              : ""}
            {data?.measure.expansion_version ?? ""}
          </p>
        </div>
        <HelpButton helpKey="workbench.care-bundles.measure" />
      </header>

      <Shell
        title="Value sets"
        subtitle={data ? `${data.value_sets.length} linked value sets` : "—"}
      >
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !data || data.value_sets.length === 0 ? (
            <p className="p-6 text-sm text-text-ghost">No value sets indexed.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">Codes</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">OMOP concepts</th>
                </tr>
              </thead>
              <tbody>
                {data.value_sets.map((vs) => (
                  <tr
                    key={vs.value_set_oid}
                    className="border-b border-border-default/60 hover:bg-surface-overlay/40"
                  >
                    <td className="px-4 py-2">
                      <Link
                        to={`/workbench/care-bundles/value-sets/${vs.value_set_oid}`}
                        className="text-sm font-medium text-text-primary hover:underline"
                      >
                        {vs.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-text-muted">
                      {vs.qdm_category ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {vs.code_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {vs.omop_concept_count > 0 ? (
                        <span className="text-teal-300">
                          {vs.omop_concept_count.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-text-ghost">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Shell>
    </div>
  );
}
