import { useState } from "react";
import { Loader2, Save, Users, X } from "lucide-react";
import { useExportRosterToCohort, useMeasureRoster } from "../hooks";
import type { ComplianceBucket } from "../types";

interface Props {
  bundleId: number | null;
  measureId: number | null;
  measureCode: string | null;
  measureName: string | null;
  sourceId: number | null;
  sourceName: string | null;
  onClose: () => void;
}

const BUCKET_LABELS: Record<ComplianceBucket, string> = {
  non_compliant: "Non-compliant",
  compliant: "Compliant",
  excluded: "Excluded",
};

export function MeasureRosterModal({
  bundleId,
  measureId,
  measureCode,
  measureName,
  sourceId,
  sourceName,
  onClose,
}: Props) {
  const [bucket, setBucket] = useState<ComplianceBucket>("non_compliant");
  const [page, setPage] = useState(1);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [cohortDescription, setCohortDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [savedCohortId, setSavedCohortId] = useState<number | null>(null);

  const rosterQuery = useMeasureRoster(bundleId, measureId, sourceId, bucket, page);
  const exporter = useExportRosterToCohort();

  if (bundleId == null || measureId == null || sourceId == null) return null;

  const data = rosterQuery.data;
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / (data?.per_page ?? 100)));

  const defaultName = () => {
    const bucketName = BUCKET_LABELS[bucket].toLowerCase().replace(/\s+/g, "-");
    return `${measureCode ?? "measure"}-${bucketName} (${sourceName ?? `src${sourceId}`})`;
  };

  const handleSave = () => {
    if (!cohortName.trim() || measureId == null || bundleId == null || sourceId == null) {
      return;
    }
    exporter.mutate(
      {
        bundleId,
        measureId,
        payload: {
          source_id: sourceId,
          bucket,
          name: cohortName.trim(),
          description: cohortDescription.trim() || null,
          is_public: isPublic,
        },
      },
      {
        onSuccess: (cohort) => {
          setSavedCohortId(cohort.id);
          setShowSaveForm(false);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl border border-border-default bg-surface-base shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-border-default bg-surface-raised px-6 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-secondary" />
            <div>
              <h2 className="text-base font-bold text-text-primary">
                Patient roster · {measureCode ?? ""}
              </h2>
              <p className="mt-0.5 text-xs text-text-ghost">
                {measureName} on {sourceName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-ghost transition-colors hover:bg-surface-overlay hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5 text-sm">
          <div className="flex items-center gap-2">
            {(Object.keys(BUCKET_LABELS) as ComplianceBucket[]).map((b) => (
              <button
                key={b}
                onClick={() => {
                  setBucket(b);
                  setPage(1);
                  setSavedCohortId(null);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  bucket === b
                    ? "border-accent bg-accent/10 text-text-primary"
                    : "border-border-default bg-surface-raised text-text-muted hover:bg-surface-overlay"
                }`}
              >
                {BUCKET_LABELS[b]}
              </button>
            ))}
            <div className="ml-auto text-xs text-text-ghost">
              {total.toLocaleString()} patient{total === 1 ? "" : "s"}
            </div>
          </div>

          {savedCohortId != null && (
            <div className="rounded-lg border border-teal-900/60 bg-teal-950/30 p-3 text-xs text-teal-200">
              <div className="font-semibold">Cohort saved · #{savedCohortId}</div>
              <div className="mt-1 opacity-90">
                {total.toLocaleString()} members written to results.cohort. Use it
                in any Study downstream.
              </div>
            </div>
          )}

          {!showSaveForm && total > 0 && savedCohortId == null && (
            <button
              onClick={() => {
                setCohortName(defaultName());
                setShowSaveForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <Save className="h-4 w-4" />
              Save {total.toLocaleString()} {BUCKET_LABELS[bucket].toLowerCase()} patients as cohort
            </button>
          )}

          {showSaveForm && (
            <div className="space-y-2 rounded-lg border border-border-default bg-surface-raised p-4">
              <div>
                <label className="text-xs font-semibold text-text-ghost">
                  Cohort name
                </label>
                <input
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  className="mt-1 w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-ghost">
                  Description (optional)
                </label>
                <textarea
                  value={cohortDescription}
                  onChange={(e) => setCohortDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Make cohort public
              </label>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!cohortName.trim() || exporter.isPending}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {exporter.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Create cohort
                </button>
                <button
                  onClick={() => setShowSaveForm(false)}
                  className="rounded-lg border border-border-default px-3 py-2 text-sm text-text-muted hover:bg-surface-overlay"
                >
                  Cancel
                </button>
              </div>
              {exporter.isError && (
                <p className="text-xs text-red-300">
                  Save failed. Try again or check the source's results schema.
                </p>
              )}
            </div>
          )}

          {rosterQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-text-ghost">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading roster…
            </div>
          )}

          {data && data.persons.length === 0 && (
            <p className="rounded border border-border-default bg-surface-raised p-4 text-xs text-text-ghost">
              No patients in this bucket.
            </p>
          )}

          {data && data.persons.length > 0 && (
            <div className="overflow-x-auto rounded border border-border-default">
              <table className="min-w-full text-xs">
                <thead className="border-b border-border-default bg-surface-raised">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-text-ghost">
                      Person ID
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-text-ghost">
                      Age
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-text-ghost">
                      Sex
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.persons.map((p) => (
                    <tr key={p.person_id} className="border-b border-border-default/40">
                      <td className="px-3 py-1.5 font-mono">{p.person_id}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {p.age ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-text-muted">{p.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lastPage > 1 && (
                <div className="flex items-center justify-between border-t border-border-default px-3 py-2 text-xs text-text-ghost">
                  <span>
                    Page {page} of {lastPage}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded border border-border-default px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                      disabled={page >= lastPage}
                      className="rounded border border-border-default px-2 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-text-ghost">
            Roster shows person_ids and minimal demographics (age, sex). Saving as
            a cohort writes the full set to <code>results.cohort</code> for use
            in downstream Studies — no PHI dates, names, or identifiers leave the
            workbench.
          </p>
        </div>
      </div>
    </div>
  );
}
