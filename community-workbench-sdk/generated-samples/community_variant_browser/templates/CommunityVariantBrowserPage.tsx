type CommunityVariantBrowserResult = {
  status: string;
  summary: Record<string, unknown>;
  warnings: string[];
  next_actions: string[];
};

const sampleResult: CommunityVariantBrowserResult = {
  status: "ok",
  summary: {
    toolId: "community_variant_browser",
    displayName: "Community Variant Browser",
  },
  warnings: [],
  next_actions: [
    "Wire this page to the generated backend API client.",
    "Replace placeholder rendering with tool-specific panels.",
  ],
};

export default function CommunityVariantBrowserPage() {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Community Variant Browser</h1>
        <p className="text-sm text-muted-foreground">Explore cohort-scoped genomic variants through a Parthenon workbench generated from the Community Workbench SDK.</p>
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
