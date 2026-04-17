import { Loader2, PanelsTopLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useInvestigations } from "@/features/investigation/hooks/useInvestigation";
import type { ToolsetDescriptor } from "../types";
import { ToolsetCard } from "../components/ToolsetCard";
import { Shell } from "@/components/workbench/primitives";

// Inline toolset registry (previously in ../toolsets.ts — removed with the
// obsolete StudyAgent FinnGen components in Task D3). The FinnGen Evidence
// Investigation toolset will be re-added once the SP2+ UI lands on the new
// FinnGen SP1 foundation hooks.
const TOOLSET_REGISTRY: ToolsetDescriptor[] = [
  {
    slug: "finngen-cohort",
    name: "FinnGen Cohort Workbench",
    tagline: "Compose, match, materialize cohorts",
    description:
      "Drag-and-drop operation builder for UNION/INTERSECT/MINUS composition across cohorts. Preview subject counts live, match 1:N on age/sex with SMD diagnostics, materialize to cohort_definitions, hand off to the Analysis Gallery.",
    icon: "GitMerge",
    accent: "var(--accent)",
    status: "available",
    route: "/workbench/cohorts",
    badge: "SP4",
  },
  {
    slug: "morpheus",
    name: "Morpheus",
    tagline: "Inpatient outcomes & ICU analytics workbench",
    description:
      "ICU-focused analytics leveraging MIMIC-IV data in OMOP CDM 5.4. ABCDEF Liberation Bundle compliance, ventilator weaning prediction, sedation monitoring, and inpatient outcome research.",
    icon: "BedDouble",
    accent: "var(--primary)",
    status: "available",
    route: "/morpheus",
    badge: "MIMIC-IV",
  },
  {
    slug: "sdk",
    name: "Build a Toolset",
    tagline: "Community SDK for third-party integrations",
    description:
      "Reference implementation and SDK documentation for building custom toolsets that plug into the Parthenon Workbench. Service descriptors, result envelopes, and artifact patterns.",
    icon: "Blocks",
    accent: "var(--accent)",
    status: "available",
    route: "/workbench/community-sdk-demo",
  },
];

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
      <Shell
        title="Toolsets"
        subtitle="Pick the workbench that fits your research question."
      >
        <div className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {visibleToolsets.map((toolset) => (
            <ToolsetCard key={toolset.slug} toolset={toolset} />
          ))}
        </div>
      </Shell>

      {/* Recent Investigations */}
      <section className="mt-8">
        <Shell
          title="Recent investigations"
          subtitle="Evidence investigations you've worked on recently."
        >
          <div className="p-4">
            {investigationsLoading && (
              <div className="flex items-center gap-2 py-4 text-sm text-text-ghost">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading investigations…</span>
              </div>
            )}

            {!investigationsLoading && recentInvestigations.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <p className="text-sm text-text-ghost">
                  Start your first Evidence Investigation.
                </p>
                <Link
                  to="/workbench/investigation/new"
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  Create Investigation
                </Link>
              </div>
            )}

            {!investigationsLoading && recentInvestigations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-end">
                  <Link
                    to="/workbench/investigation/new"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    New Investigation
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {recentInvestigations.map((inv) => (
                    <Link
                      key={inv.id}
                      to={`/workbench/investigation/${inv.id}`}
                      className="group flex items-center justify-between rounded-xl border border-border-default bg-surface-base/50 px-4 py-3 transition-colors hover:bg-surface-overlay/60"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="truncate text-sm text-text-primary transition-colors group-hover:text-text-primary">
                          {inv.title}
                        </span>
                        <span
                          className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[inv.status] ?? "bg-surface-raised text-text-muted"}`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <span className="ml-4 shrink-0 text-xs text-text-ghost">
                        {formatDate(inv.updated_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Shell>
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
