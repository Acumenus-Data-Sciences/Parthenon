import { Loader2, PanelsTopLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useInvestigations } from "@/features/investigation/hooks/useInvestigation";
import { TOOLSET_REGISTRY } from "../toolsets";
import { ToolsetCard } from "../components/ToolsetCard";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-surface-raised text-text-muted",
  active: "bg-teal-900 text-teal-300",
  complete: "bg-emerald-900 text-emerald-300",
  archived: "bg-surface-raised text-text-ghost",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WorkbenchLauncherPage() {
  const studyAgentEnabled =
    import.meta.env.VITE_STUDY_AGENT_ENABLED === "true";

  const visibleToolsets = TOOLSET_REGISTRY.filter(
    (t) => !t.requiresStudyAgent || studyAgentEnabled,
  );

  const { data: investigationsPage, isLoading: investigationsLoading } =
    useInvestigations();

  const recentInvestigations = investigationsPage?.data?.slice(0, 5) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised">
            <PanelsTopLeft className="h-5 w-5 text-text-secondary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Workbench</h1>
            <p className="text-sm text-text-ghost">
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

      {/* Recent Investigations */}
      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">
            Recent Investigations
          </h2>
          <Link
            to="/workbench/investigation/new"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}
          >
            New Investigation
          </Link>
        </div>

        {investigationsLoading ? (
          <div className="flex items-center gap-2 text-text-ghost text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading investigations...</span>
          </div>
        ) : recentInvestigations.length === 0 ? (
          <div className="bg-surface-base/50 border border-border-default rounded-xl p-6 text-center">
            <p className="text-sm text-text-ghost mb-3">
              Start your first Evidence Investigation
            </p>
            <Link
              to="/workbench/investigation/new"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--primary)" }}
            >
              Create Investigation
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentInvestigations.map((inv) => (
              <Link
                key={inv.id}
                to={`/workbench/investigation/${inv.id}`}
                className="flex items-center justify-between bg-surface-base/50 border border-border-default rounded-xl px-4 py-3 hover:border-border-default transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm text-text-primary truncate group-hover:text-text-primary transition-colors">
                    {inv.title}
                  </span>
                  <span
                    className={`shrink-0 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inv.status] ?? "bg-surface-raised text-text-muted"}`}
                  >
                    {inv.status}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-text-ghost ml-4">
                  {formatDate(inv.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Footer hint */}
      <div className="mt-12 text-center">
        <p className="text-xs text-text-ghost">
          Want to build a custom toolset?{" "}
          <a
            href="/workbench/community-sdk-demo"
            className="text-accent hover:underline"
          >
            View the Community SDK reference
          </a>
        </p>
      </div>
    </div>
  );
}
