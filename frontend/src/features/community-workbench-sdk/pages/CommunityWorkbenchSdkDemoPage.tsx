import { ArrowLeft, ArrowUpRight, Blocks, FileCode2, Loader2, ShieldCheck, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCommunityWorkbenchSdkDemo } from "../hooks/useCommunityWorkbenchSdkDemo";

const SAMPLE_GENERATED_PATH =
  "community-workbench-sdk/generated-samples/community_variant_browser"; // i18n-exempt: repository sample path.

export default function CommunityWorkbenchSdkDemoPage() {
  const { t } = useTranslation("app");
  const { data, isLoading, isError } = useCommunityWorkbenchSdkDemo();

  const serviceDescriptor = data?.service_descriptor;
  const resultEnvelope = data?.result_envelope;
  const generatedSample = data?.generated_sample;
  const integrationChecklist = [
    t("communityWorkbenchSdk.checklist.items.serviceRegistry", {
      path: "study-agent/docs/SERVICE_REGISTRY.yaml",
    }),
    t("communityWorkbenchSdk.checklist.items.toolModule", {
      path: "study-agent/mcp_server/study_agent_mcp/tools/__init__.py",
    }),
    t("communityWorkbenchSdk.checklist.items.backendController"),
    t("communityWorkbenchSdk.checklist.items.frontendRoute"),
    t("communityWorkbenchSdk.checklist.items.validatePayloads"),
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-default bg-surface-darkest/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-success-light">
              <Blocks className="h-3.5 w-3.5" />
              {t("communityWorkbenchSdk.page.badge")}
            </div>
            <h1 className="text-3xl font-semibold text-text-primary">
              {t("communityWorkbenchSdk.page.title")}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-text-muted">
              {t("communityWorkbenchSdk.page.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/workbench"
              className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-base/60 px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-raised"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("communityWorkbenchSdk.page.backToWorkbench")}
            </a>
            <a
              href="/docs/community-workbench-sdk"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success-light transition-colors hover:bg-success/20"
            >
              {t("communityWorkbenchSdk.page.openSdkDocs")}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="rounded-2xl border border-border-default bg-surface-base/50 p-6 text-sm text-text-secondary">
          <div className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("communityWorkbenchSdk.page.loading")}
          </div>
        </section>
      ) : null}

      {isError ? (
        <section className="rounded-2xl border border-critical/30 bg-primary/10 p-6 text-sm text-text-primary">
          {t("communityWorkbenchSdk.page.failed")}
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border-default bg-surface-base/50 p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
            <ShieldCheck className="h-4 w-4 text-success" />
            {t("communityWorkbenchSdk.serviceDescriptor.title")}
          </div>
          <p className="mb-4 text-sm leading-6 text-text-muted">
            {t("communityWorkbenchSdk.serviceDescriptor.description")}
          </p>
          <pre className="overflow-x-auto rounded-xl border border-border-default bg-surface-darkest/80 p-4 text-xs leading-6 text-text-secondary">
            {JSON.stringify(serviceDescriptor ?? {}, null, 2)}
          </pre>
        </div>

        <div className="rounded-2xl border border-border-default bg-surface-base/50 p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
            <Wrench className="h-4 w-4 text-accent" />
            {t("communityWorkbenchSdk.checklist.title")}
          </div>
          <div className="space-y-3">
            {integrationChecklist.map((item, index) => (
              <div key={item} className="rounded-xl border border-border-default bg-surface-darkest/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-ghost">
                  {t("communityWorkbenchSdk.checklist.step", {
                    index: index + 1,
                  })}
                </div>
                <div className="mt-2 text-sm leading-6 text-text-secondary">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-base/50 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
          <FileCode2 className="h-4 w-4 text-info" />
          {t("communityWorkbenchSdk.resultEnvelope.title")}
        </div>
        <p className="mb-4 text-sm leading-6 text-text-muted">
          {t("communityWorkbenchSdk.resultEnvelope.description")}
        </p>
        <pre className="overflow-x-auto rounded-xl border border-border-default bg-surface-darkest/80 p-4 text-xs leading-6 text-text-secondary">
          {JSON.stringify(resultEnvelope ?? {}, null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-base/50 p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-text-primary">
          <Blocks className="h-4 w-4 text-critical" />
          {t("communityWorkbenchSdk.artifacts.title")}
        </div>
        <p className="mb-4 text-sm leading-6 text-text-muted">
          {t("communityWorkbenchSdk.artifacts.descriptionPrefix")}
          <span className="mx-1 rounded bg-surface-darkest px-1.5 py-0.5 font-mono text-xs text-text-secondary">
            {generatedSample?.path ?? SAMPLE_GENERATED_PATH}
          </span>
          {t("communityWorkbenchSdk.artifacts.descriptionSuffix")}
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
