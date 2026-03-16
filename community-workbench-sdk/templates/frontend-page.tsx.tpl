type __TYPE_NAME__Result = {
  status: string;
  summary: Record<string, unknown>;
  warnings: string[];
  next_actions: string[];
};

const sampleResult: __TYPE_NAME__Result = {
  status: "ok",
  summary: {
    toolId: "__TOOL_ID__",
    displayName: "__DISPLAY_NAME__",
  },
  warnings: [],
  next_actions: [
    "Wire this page to the generated backend API client.",
    "Replace placeholder rendering with tool-specific panels.",
  ],
};

export default function __TYPE_NAME__Page() {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">__DISPLAY_NAME__</h1>
        <p className="text-sm text-muted-foreground">__DESCRIPTION__</p>
      </header>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium">Starter scaffold</p>
        <pre className="mt-3 overflow-x-auto text-xs">
          {JSON.stringify(sampleResult, null, 2)}
        </pre>
      </div>
    </section>
  );
}
