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
      <div className="w-full rounded-2xl border border-critical/20 bg-surface-raised p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl border border-critical/25 bg-critical/10 p-2.5">
            <AlertTriangle size={18} className="text-critical" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
            <p className="text-sm text-text-muted">
              This analysis page hit a render or route-loading error.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-surface-base px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            Error
          </p>
          <p className="mt-2 break-words text-sm text-text-primary">{message}</p>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/analyses")}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary transition-colors hover:border-surface-highlight hover:text-text-primary"
          >
            <ArrowLeft size={14} />
            Back To Analyses
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
