import { AlertTriangle, ArrowLeft } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface AnalysisRouteErrorProps {
  titleKey: string;
}

function getErrorMessage(
  error: unknown,
  routeErrorLabel: string,
  pageFailedLabel: string,
): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText || routeErrorLabel}`.trim();
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return pageFailedLabel;
}

export function AnalysisRouteError({ titleKey }: AnalysisRouteErrorProps) {
  const navigate = useNavigate();
  const error = useRouteError();
  const { t } = useTranslation("app");
  const message = getErrorMessage(
    error,
    t("errors.route.routeError"),
    t("errors.route.pageFailed"),
  );

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-6">
      <div className="w-full rounded-2xl border border-critical/20 bg-surface-raised p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl border border-critical/25 bg-critical/10 p-2.5">
            <AlertTriangle size={18} className="text-critical" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              {t(titleKey)}
            </h1>
            <p className="text-sm text-text-muted">
              {t("errors.route.analysisDescription")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-surface-base px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
            {t("errors.route.label")}
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
            {t("errors.route.backToAnalyses")}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success-dark"
          >
            {t("errors.route.reloadPage")}
          </button>
        </div>
      </div>
    </div>
  );
}
