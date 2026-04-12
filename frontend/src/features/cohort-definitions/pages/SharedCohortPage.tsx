import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertTriangle, FileText } from "lucide-react";
import { getSharedCohort } from "../api/cohortApi";

interface SharedCohort {
  id: number;
  name: string;
  description?: string;
  expression: Record<string, unknown>;
  expires_at: string;
}

export default function SharedCohortPage() {
  const { token } = useParams<{ token: string }>();
  const [cohort, setCohort] = useState<SharedCohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getSharedCohort(token)
      .then(setCohort)
      .catch(() => setError("This link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle size={32} className="text-critical mx-auto" />
          <p className="text-text-primary font-medium">Link Not Found</p>
          <p className="text-sm text-text-muted">
            {error ?? "This shared link is invalid or has expired."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Branding banner */}
        <div className="text-center space-y-1">
          <p className="text-xs text-text-ghost uppercase tracking-widest">
            Shared via Parthenon
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-surface-overlay border border-border-default overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border-default flex items-start gap-3">
            <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-success/10">
              <FileText size={16} className="text-success" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-text-primary">
                {cohort.name}
              </h1>
              {cohort.description && (
                <p className="mt-1 text-sm text-text-muted">
                  {cohort.description}
                </p>
              )}
              <p className="mt-2 text-[10px] text-text-ghost">
                Link expires:{" "}
                {new Date(cohort.expires_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Expression JSON (read-only) */}
          <div className="px-6 py-5">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Cohort Expression
            </h2>
            <pre className="bg-surface-base rounded-lg border border-border-default p-4 text-xs text-text-secondary font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">
              {JSON.stringify(cohort.expression, null, 2)}
            </pre>
          </div>
        </div>

        <p className="text-center text-[10px] text-text-disabled">
          Read-only view · Parthenon Outcomes Research Platform
        </p>
      </div>
    </div>
  );
}
