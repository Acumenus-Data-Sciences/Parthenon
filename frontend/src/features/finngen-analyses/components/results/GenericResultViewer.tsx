// frontend/src/features/finngen-analyses/components/results/GenericResultViewer.tsx

interface GenericResultViewerProps {
  display: unknown;
}

export function GenericResultViewer({ display }: GenericResultViewerProps) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <h3 className="text-xs font-semibold text-text-secondary mb-3">Raw Results (JSON)</h3>
      <pre className="max-h-96 overflow-auto rounded bg-surface-base p-3 text-xs text-text-muted font-mono whitespace-pre-wrap">
        {JSON.stringify(display, null, 2)}
      </pre>
    </div>
  );
}
