import { PanelsTopLeft } from "lucide-react";
import { TOOLSET_REGISTRY } from "../toolsets";
import { ToolsetCard } from "../components/ToolsetCard";

export default function WorkbenchLauncherPage() {
  const studyAgentEnabled =
    import.meta.env.VITE_STUDY_AGENT_ENABLED === "true";

  const visibleToolsets = TOOLSET_REGISTRY.filter(
    (t) => !t.requiresStudyAgent || studyAgentEnabled,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800">
            <PanelsTopLeft className="h-5 w-5 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Workbench</h1>
            <p className="text-sm text-zinc-500">
              Novel capabilities and research toolsets
            </p>
          </div>
        </div>
      </div>

      {/* Toolset Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleToolsets.map((toolset) => (
          <ToolsetCard key={toolset.slug} toolset={toolset} />
        ))}
      </div>

      {/* Footer hint */}
      <div className="mt-12 text-center">
        <p className="text-xs text-zinc-600">
          Want to build a custom toolset?{" "}
          <a
            href="/workbench/community-sdk-demo"
            className="text-[#C9A227] hover:underline"
          >
            View the Community SDK reference
          </a>
        </p>
      </div>
    </div>
  );
}
