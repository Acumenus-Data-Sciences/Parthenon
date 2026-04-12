import { ArrowLeft, ArrowUpRight, Blocks, FileCode2, Loader2, ShieldCheck, Wrench } from "lucide-react";
import { useCommunityWorkbenchSdkDemo } from "../hooks/useCommunityWorkbenchSdkDemo";

const integrationChecklist = [
  "Add a service registry entry in study-agent/docs/SERVICE_REGISTRY.yaml.",
  "Register the MCP tool module in study-agent/mcp_server/study_agent_mcp/tools/__init__.py.",
  "Wire a backend controller and workbench service for validation, permissions, and persistence.",
  "Add a frontend route and replace placeholder panels with domain-specific rendering.",
  "Validate real payloads against the Community Workbench SDK schemas before release.",
];

export default function CommunityWorkbenchSdkDemoPage() {
  const { data, isLoading, isError } = useCommunityWorkbenchSdkDemo();

  const serviceDescriptor = data?.service_descriptor;
  const resultEnvelope = data?.result_envelope;
  const generatedSample = data?.generated_sample;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-default bg-surface-darkest/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#7CE8D5]">
              <Blocks className="h-3.5 w-3.5" />
              Phase 3 Demo
            </div>
            <h1 className="text-3xl font-semibold text-text-primary">Community Workbench SDK Demo</h1>
            <p className="max-w-2xl text-sm leading-6 text-text-muted">
              This sandbox page shows what an SDK-generated tool looks like inside Parthenon before
              domain-specific logic is wired in. It is a non-production reference implementation for
              community developers, partner teams, and AI coding assistants.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/workbench"
              className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-base/60 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-raised"
            >
              <ArrowLeft className="h-4 w-4" />
              Back To Workbench
            </a>
            <a
              href="/docs/community-workbench-sdk"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-2 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/20"
            >
              Open SDK Docs
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="rounded-2xl border border-border-default bg-surface-base/50 p-6 text-sm text-text-secondary">
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading demo payload from Parthenon backend...
          </div>
        </section>
      ) : null}

      {isError ? (
        <section className="rounded-2xl border border-[#E85A6B]/30 bg-[#9B1B30]/10 p-6 text-sm text-[#F0EDE8]">
          The Community Workbench SDK demo payload could not be loaded from the backend.
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border-default bg-surface-base/50 p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
            <ShieldCheck className="h-4 w-4 text-[#2DD4BF]" />
            Sample Service Descriptor
          </div>
          <p className="mb-4 text-sm leading-6 text-text-muted">
            This is the discovery and availability metadata a generated tool should expose before
            the frontend renders the workbench surface.
          </p>
          <pre className="overflow-x-auto rounded-xl border border-border-default bg-surface-darkest/80 p-4 text-xs leading-6 text-text-secondary">
            {JSON.stringify(serviceDescriptor ?? {}, null, 2)}
          </pre>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-base/50 p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
            <Wrench className="h-4 w-4 text-[#C9A227]" />
            Integration Checklist
          </div>
          <div className="space-y-3">
            {integrationChecklist.map((item, index) => (
              <div key={item} className="rounded-xl border border-border-default bg-surface-darkest/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-ghost">
                  Step {index + 1}
                </div>
                <div className="mt-2 text-sm leading-6 text-text-secondary">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-base/50 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
          <FileCode2 className="h-4 w-4 text-[#60A5FA]" />
          Sample Result Envelope
        </div>
        <p className="mb-4 text-sm leading-6 text-text-muted">
          SDK-generated tools should normalize their runtime diagnostics, source context, summary,
          and artifacts into a predictable envelope like this before rendering richer panels.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-border-default bg-surface-darkest/80 p-4 text-xs leading-6 text-text-secondary">
          {JSON.stringify(resultEnvelope ?? {}, null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-base/50 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
          <Blocks className="h-4 w-4 text-[#E85A6B]" />
          Generated Artifact Inventory
        </div>
        <p className="mb-4 text-sm leading-6 text-text-muted">
          This demo is backed by a real generated sample scaffold at
          <span className="mx-1 rounded bg-surface-darkest px-1.5 py-0.5 font-mono text-xs text-text-secondary">
            {generatedSample?.path ?? "community-workbench-sdk/generated-samples/community_variant_browser"}
          </span>
          in the repository.
        </p>
        {generatedSample?.readme_excerpt ? (
          <pre className="mb-4 overflow-x-auto rounded-xl border border-border-default bg-surface-darkest/80 p-4 text-xs leading-6 text-text-secondary">
            {generatedSample.readme_excerpt}
          </pre>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(generatedSample?.files ?? []).map((entry) => (
            <div key={entry} className="rounded-xl border border-border-default bg-surface-darkest/70 px-4 py-3 font-mono text-xs text-text-secondary">
              {entry}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
