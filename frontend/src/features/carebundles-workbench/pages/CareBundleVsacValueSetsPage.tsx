import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { List, Loader2, Search } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { useVsacValueSets } from "../hooks";
import { WorkbenchTabs } from "../components/WorkbenchTabs";

const CODE_SYSTEMS = [
  "", "SNOMEDCT", "ICD10CM", "ICD10PCS", "LOINC", "RXNORM", "CPT", "HCPCS Level II",
] as const;

export default function CareBundleVsacValueSetsPage() {
  const [q, setQ] = useState("");
  const [codeSystem, setCodeSystem] = useState<string>("");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      q: q || undefined,
      code_system: codeSystem || undefined,
      page,
      per_page: 50,
    }),
    [q, codeSystem, page],
  );

  const query = useVsacValueSets(params);
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
          <List className="h-5 w-5 text-text-secondary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">VSAC Value Sets</h1>
          <p className="text-sm text-text-ghost">
            CMS Value Set Authority Center library — {meta?.total?.toLocaleString() ?? "…"} value sets indexed.
          </p>
        </div>
      </header>

      <WorkbenchTabs />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-ghost" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or paste an OID…"
            className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
          />
        </div>
        <select
          value={codeSystem}
          onChange={(e) => {
            setCodeSystem(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary"
        >
          <option value="">All code systems</option>
          {CODE_SYSTEMS.filter(Boolean).map((cs) => (
            <option key={cs} value={cs}>{cs}</option>
          ))}
        </select>
      </div>

      <Shell title="Value sets" subtitle={`Page ${meta?.page ?? 1} of ${meta?.last_page ?? "?"}`}>
        <div className="overflow-x-auto">
          {query.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-text-ghost">No value sets match.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">OID</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">Codes</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">OMOP concepts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((vs) => (
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
                    <td className="px-4 py-2 font-mono text-[11px] text-text-ghost">
                      {vs.value_set_oid}
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

        {meta && meta.last_page != null && meta.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 text-xs text-text-ghost">
            <span>
              {meta.total.toLocaleString()} total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-border-default px-2 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                {page} / {meta.last_page}
              </span>
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
