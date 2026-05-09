import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Scale, Search } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { HelpButton } from "@/features/help";
import { useVsacMeasures } from "../hooks";
import { WorkbenchTabs } from "../components/WorkbenchTabs";
import { tAuto } from "@/i18n/autoUserFacing";

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
            <h1 className="text-2xl font-bold text-text-primary">{tAuto("cmsMeasures_a37c082e")}</h1>
            <p className="text-sm text-text-ghost">
              {meta?.total?.toLocaleString() ?? "…"} {tAuto("cmsEcqmsEachLinksToItsVsacValue_a148023e")}
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
          placeholder={tAuto("searchByCmsIdCbeNumberOrTitle_3d0f7585")}
          className="w-full rounded-lg border border-border-default bg-surface-raised py-2 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-ghost focus:border-accent focus:outline-none"
        />
      </div>

      <Shell title={tAuto("measures_724255a4")} subtitle={`Page ${meta?.page ?? 1} of ${meta?.last_page ?? "?"}`}>
        <div className="overflow-x-auto">
          {query.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" /> {tAuto("loading_33ce4174")}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-text-ghost">{tAuto("noMeasuresMatch_eedad763")}</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">{tAuto("cmsId_e0933eee")}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">Measure</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">{tAuto("cbe_d361282b")}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">{tAuto("program_9d68007b")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-text-ghost">{tAuto("valueSets_0992621f")}</th>
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
                    <td className="max-w-[28rem] px-4 py-2 text-sm text-text-primary">
                      {m.title ? (
                        <Link
                          to={`/workbench/care-bundles/measures/${m.cms_id}`}
                          title={m.title}
                          className="block truncate hover:underline"
                        >
                          {m.title}
                        </Link>
                      ) : (
                        <span className="text-text-ghost">—</span>
                      )}
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
                {tAuto("prev_e96fea52")}
              </button>
              <span>{page} / {meta.last_page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={meta.last_page != null && page >= meta.last_page}
                className="rounded border border-border-default px-2 py-1 disabled:opacity-40"
              >
                {tAuto("next_bc981983")}
              </button>
            </div>
          </div>
        )}
      </Shell>
    </div>
  );
}
