import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useInvestigation } from "../hooks/useInvestigation";
import { EvidenceBoard } from "../components/EvidenceBoard";
import {
  safePhenotypeState,
  safeClinicalState,
  safeGenomicState,
  safeSynthesisState,
} from "../lib/safeState";

export default function InvestigationPage() {
  const { investigationId } = useParams<{ investigationId: string }>();
  const { data: investigation, isLoading, isError } = useInvestigation(
    investigationId ? Number(investigationId) : 0,
  );

  // Normalise domain state fields that PHP may serialise as `[]` instead of `{}`
  // when the column has never been written to (json_encode([]) → `[]` not `{}`).
  const safeInvestigation = useMemo(() => {
    if (!investigation) return null;
    return {
      ...investigation,
      phenotype_state: safePhenotypeState(investigation.phenotype_state),
      clinical_state: safeClinicalState(investigation.clinical_state),
      genomic_state: safeGenomicState(investigation.genomic_state),
      synthesis_state: safeSynthesisState(investigation.synthesis_state),
    };
  }, [investigation]);

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--surface-base)" }}
      >
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading investigation...</span>
        </div>
      </div>
    );
  }

  if (isError || !safeInvestigation) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--surface-base)" }}
      >
        <div className="text-center space-y-3">
          <p className="text-zinc-400 text-sm">
            Investigation not found or could not be loaded.
          </p>
          <Link
            to="/workbench"
            className="inline-block text-sm text-success hover:underline"
          >
            Back to Workbench
          </Link>
        </div>
      </div>
    );
  }

  return <EvidenceBoard investigation={safeInvestigation} />;
}
