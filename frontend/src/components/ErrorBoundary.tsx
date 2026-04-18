import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function DefaultErrorFallback({
  error,
  onReload,
}: {
  error: Error | null;
  onReload: () => void;
}) {
  const { t } = useTranslation("app");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base p-8">
      <div className="max-w-md space-y-4 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-accent" />
        <h1 className="text-xl font-semibold text-text-primary">
          {t("errors.boundary.title")}
        </h1>
        <p className="text-sm text-text-muted">
          {t("errors.boundary.message")}
        </p>
        {error && (
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-border-default bg-surface-raised p-3 text-left text-xs text-primary">
            {error.message}
          </pre>
        )}
        <button
          onClick={onReload}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-accent/90"
        >
          <RefreshCw size={14} />
          {t("errors.boundary.reloadPage")}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <DefaultErrorFallback
        error={this.state.error}
        onReload={this.handleReload}
      />
    );
  }
}
