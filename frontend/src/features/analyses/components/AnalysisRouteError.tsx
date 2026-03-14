import { AlertTriangle, ArrowLeft } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

interface AnalysisRouteErrorProps {
  title: string;
}

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText || "Route error"}`.trim();
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "The page failed to render.";
}

export function AnalysisRouteError({ title }: AnalysisRouteErrorProps) {
  const navigate = useNavigate();
  const error = useRouteError();
  const message = getErrorMessage(error);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-6">
      <div className="w-full rounded-2xl border border-[#E85A6B]/20 bg-[#151518] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl border border-[#E85A6B]/25 bg-[#E85A6B]/10 p-2.5">
            <AlertTriangle size={18} className="text-[#E85A6B]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#F0EDE8]">{title}</h1>
            <p className="text-sm text-[#8A857D]">
              This analysis page hit a render or route-loading error.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[#232328] bg-[#0E0E11] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8A857D]">
            Error
          </p>
          <p className="mt-2 break-words text-sm text-[#F0EDE8]">{message}</p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/analyses")}
            className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#1A1A1E] px-4 py-2 text-sm text-[#C5C0B8] transition-colors hover:border-[#323238] hover:text-[#F0EDE8]"
          >
            <ArrowLeft size={14} />
            Back To Analyses
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#26B8A5]"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
