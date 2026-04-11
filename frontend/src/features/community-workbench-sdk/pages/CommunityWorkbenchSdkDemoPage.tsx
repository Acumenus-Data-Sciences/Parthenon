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
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#7CE8D5]">
              <Blocks className="h-3.5 w-3.5" />
              Phase 3 Demo
            </div>
            <h1 className="text-3xl font-semibold text-white">Community Workbench SDK Demo</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-400">
              This sandbox page shows what an SDK-generated tool looks like inside Parthenon before
              domain-specific logic is wired in. It is a non-production reference implementation for
              community developers, partner teams, and AI coding assistants.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/workbench"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back To Workbench
            </a>
            <a
              href="/docs/community-workbench-sdk"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-success/20"
            >
              Open SDK Docs
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-300">
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading demo payload from Parthenon backend...
          </div>
        </section>
      ) : null}

      {isError ? (
        <section className="rounded-2xl border border-critical/30 bg-primary/10 p-6 text-sm text-text-primary">
          The Community Workbench SDK demo payload could not be loaded from the backend.
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
            <ShieldCheck className="h-4 w-4 text-success" />
            Sample Service Descriptor
          </div>
          <p className="mb-4 text-sm leading-6 text-zinc-400">
            This is the discovery and availability metadata a generated tool should expose before
            the frontend renders the workbench surface.
          </p>
          <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs leading-6 text-zinc-300">
            {JSON.stringify(serviceDescriptor ?? {}, null, 2)}
          </pre>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
            <Wrench className="h-4 w-4 text-accent" />
            Integration Checklist
          </div>
          <div className="space-y-3">
            {integrationChecklist.map((item, index) => (
              <div key={item} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Step {index + 1}
                </div>
                <div className="mt-2 text-sm leading-6 text-zinc-300">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
          <FileCode2 className="h-4 w-4 text-info" />
          Sample Result Envelope
        </div>
        <p className="mb-4 text-sm leading-6 text-zinc-400">
          SDK-generated tools should normalize their runtime diagnostics, source context, summary,
          and artifacts into a predictable envelope like this before rendering richer panels.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs leading-6 text-zinc-300">
          {JSON.stringify(resultEnvelope ?? {}, null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
          <Blocks className="h-4 w-4 text-critical" />
          Generated Artifact Inventory
        </div>
        <p className="mb-4 text-sm leading-6 text-zinc-400">
          This demo is backed by a real generated sample scaffold at
          <span className="mx-1 rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-xs text-zinc-300">
            {generatedSample?.path ?? "community-workbench-sdk/generated-samples/community_variant_browser"}
          </span>
          in the repository.
        </p>
        {generatedSample?.readme_excerpt ? (
          <pre className="mb-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-xs leading-6 text-zinc-300">
            {generatedSample.readme_excerpt}
          </pre>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(generatedSample?.files ?? []).map((entry) => (
            <div key={entry} className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 font-mono text-xs text-zinc-300">
              {entry}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
