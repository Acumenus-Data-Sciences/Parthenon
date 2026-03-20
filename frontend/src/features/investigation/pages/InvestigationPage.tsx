import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useInvestigation } from "../hooks/useInvestigation";
import { EvidenceBoard } from "../components/EvidenceBoard";

export default function InvestigationPage() {
  const { investigationId } = useParams<{ investigationId: string }>();
  const { data: investigation, isLoading, isError } = useInvestigation(
    investigationId ? Number(investigationId) : 0,
  );

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#0E0E11" }}
      >
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading investigation...</span>
        </div>
      </div>
    );
  }

  if (isError || !investigation) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "#0E0E11" }}
      >
        <div className="text-center space-y-3">
          <p className="text-zinc-400 text-sm">
            Investigation not found or could not be loaded.
          </p>
          <Link
            to="/workbench"
            className="inline-block text-sm text-[#2DD4BF] hover:underline"
          >
            Back to Workbench
          </Link>
        </div>
      </div>
    );
  }

  return <EvidenceBoard investigation={investigation} />;
}
