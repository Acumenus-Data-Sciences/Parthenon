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
      <div className="min-h-screen bg-[#0E0E11] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="min-h-screen bg-[#0E0E11] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle size={32} className="text-[#E85A6B] mx-auto" />
          <p className="text-[#F0EDE8] font-medium">Link Not Found</p>
          <p className="text-sm text-[#8A857D]">
            {error ?? "This shared link is invalid or has expired."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E11] px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Branding banner */}
        <div className="text-center space-y-1">
          <p className="text-xs text-[#5A5650] uppercase tracking-widest">
            Shared via Parthenon
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-[#1A1A1F] border border-[#2A2A30] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#2A2A30] flex items-start gap-3">
            <div className="mt-0.5 shrink-0 p-2 rounded-lg bg-[#2DD4BF]/10">
              <FileText size={16} className="text-[#2DD4BF]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#F0EDE8]">
                {cohort.name}
              </h1>
              {cohort.description && (
                <p className="mt-1 text-sm text-[#8A857D]">
                  {cohort.description}
                </p>
              )}
              <p className="mt-2 text-[10px] text-[#5A5650]">
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
            <h2 className="text-xs font-semibold text-[#8A857D] uppercase tracking-wider mb-3">
              Cohort Expression
            </h2>
            <pre className="bg-[#0E0E11] rounded-lg border border-[#2A2A30] p-4 text-xs text-[#C5C0B8] font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">
              {JSON.stringify(cohort.expression, null, 2)}
            </pre>
          </div>
        </div>

        <p className="text-center text-[10px] text-[#3A3A42]">
          Read-only view · Parthenon Outcomes Research Platform
        </p>
      </div>
    </div>
  );
}
