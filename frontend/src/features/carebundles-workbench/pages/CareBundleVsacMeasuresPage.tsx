import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Scale, Search } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { HelpButton } from "@/features/help";
import { useVsacMeasures } from "../hooks";
import { WorkbenchTabs } from "../components/WorkbenchTabs";

export default function CareBundleVsacMeasuresPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({ q: q || undefined, page, per_page: 50 }),
    [q, page],
  );
  const query = useVsacMeasures(params);
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
            <Scale className="h-5 w-5 text-text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">CMS Measures</h1>
            <p className="text-sm text-text-ghost">
              {meta?.total?.toLocaleString() ?? "…"} CMS eCQMs — each links to its VSAC value sets and OMOP mappings.
            </p>
          </div>
        </div>
        <HelpButton helpKey="workbench.care-bundles.measures" />
      </header>

      <WorkbenchTabs />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-ghost" />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search by CMS ID, CBE number, or title…"
          className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
        />
      </div>

      <Shell title="Measures" subtitle={`Page ${meta?.page ?? 1} of ${meta?.last_page ?? "?"}`}>
        <div className="overflow-x-auto">
          {query.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-text-ghost">No measures match.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">CMS ID</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">CBE #</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">Program</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">Value sets</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr
                    key={m.cms_id}
                    className="border-b border-border-default/60 hover:bg-surface-overlay/40"
                  >
                    <td className="px-4 py-2">
                      <Link
                        to={`/workbench/care-bundles/measures/${m.cms_id}`}
                        className="text-sm font-medium text-text-primary hover:underline"
                      >
                        {m.cms_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-text-muted">{m.cbe_number ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-text-muted">{m.program_candidate ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {m.value_set_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {meta && meta.last_page != null && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 text-xs text-text-ghost">
            <span>{meta.total.toLocaleString()} total</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-border-default px-2 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <span>{page} / {meta.last_page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={meta.last_page != null && page >= meta.last_page}
                className="rounded border border-border-default px-2 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Shell>
    </div>
  );
}
