import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { Shell } from "@/components/workbench/primitives";
import { HelpButton } from "@/features/help";
import { useVsacCodes, useVsacOmopConcepts, useVsacValueSet } from "../hooks";
import { WorkbenchTabs } from "../components/WorkbenchTabs";

export default function CareBundleVsacValueSetDetailPage() {
  const { oid: oidParam } = useParams<{ oid: string }>();
  const oid = oidParam ?? null;

  const detail = useVsacValueSet(oid);
  const codes = useVsacCodes(oid, { per_page: 100 });
  const omop = useVsacOmopConcepts(oid, { per_page: 1000 });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const d = detail.data;

  const copyConceptIds = async () => {
    const ids = (omop.data?.data ?? []).map((c) => c.concept_id);
    try {
      await navigator.clipboard.writeText(JSON.stringify(ids));
      setCopyError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError("Clipboard blocked — check browser permissions.");
      window.setTimeout(() => setCopyError(null), 3000);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <WorkbenchTabs />

      <Link
        to="/workbench/care-bundles/value-sets"
        className="inline-flex items-center gap-1 text-xs text-text-ghost hover:text-text-primary"
      >
        <ArrowLeft className="h-3 w-3" /> Value Sets
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {d?.value_set.name ?? "…"}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-text-ghost">
            {oid} · {d?.value_set.expansion_version ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton helpKey="workbench.care-bundles.value-set" />
          <button
            onClick={() => {
              void copyConceptIds();
            }}
            disabled={!omop.data || omop.data.data.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--accent)" }}
            title="Copy all OMOP concept_ids as JSON array — paste into a care bundle's omop_concept_ids"
          >
            <Copy className="h-4 w-4" />
            {copyError ? "Copy failed" : copied ? "Copied!" : "Copy OMOP concept_ids"}
          </button>
        </div>
      </header>

      {copyError && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-200"
        >
          {copyError}
        </p>
      )}

      {d && (
        <section className="grid grid-cols-4 gap-3">
          <MetricTile label="Codes" value={d.code_count.toLocaleString()} />
          <MetricTile label="OMOP concepts" value={d.omop_concept_count.toLocaleString()} />
          <MetricTile label="Code systems" value={String(d.code_systems.length)} />
          <MetricTile label="Linked measures" value={String(d.linked_measures.length)} />
        </section>
      )}

      {d?.value_set.purpose_clinical_focus && (
        <Shell title="Clinical focus">
          <p className="p-4 text-sm text-text-muted">{d.value_set.purpose_clinical_focus}</p>
        </Shell>
      )}

      {d && d.linked_measures.length > 0 && (
        <Shell title="Used by CMS measures">
          <ul className="divide-y divide-border-default/50">
            {d.linked_measures.map((m) => (
              <li key={m.cms_id} className="flex items-center justify-between px-4 py-2">
                <Link
                  to={`/workbench/care-bundles/measures/${m.cms_id}`}
                  className="text-sm font-medium text-text-primary hover:underline"
                >
                  {m.cms_id}
                </Link>
                <span className="text-xs text-text-ghost">{m.cbe_number ?? "—"}</span>
              </li>
            ))}
          </ul>
        </Shell>
      )}

      <Shell
        title="Codes"
        subtitle={codes.data ? `${codes.data.meta.total.toLocaleString()} codes` : "—"}
      >
        <div className="overflow-x-auto">
          {codes.isLoading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-text-ghost">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading codes…
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-border-default">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">Code</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">System</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-text-ghost">Description</th>
                </tr>
              </thead>
              <tbody>
                {(codes.data?.data ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-border-default/60">
                    <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-4 py-2 text-xs text-text-muted">{c.code_system}</td>
                    <td className="px-4 py-2 text-xs text-text-muted">{c.description ?? "—"}</td>
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-ghost">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}
