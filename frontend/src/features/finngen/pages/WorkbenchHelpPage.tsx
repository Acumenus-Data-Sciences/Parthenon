import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  FileCode2,
  FlaskConical,
  Radar,
  Lightbulb,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";

const steps = [
  {
    number: 1,
    title: "ROMOPAPI",
    subtitle: "Explore the CDM source",
    icon: Database,
    accent: "#60A5FA",
    description:
      "Start here when you need to understand what is available in your CDM before building cohorts or analyses. ROMOPAPI inspects OMOP schema metadata, table relationships, and concept hierarchies.",
    whatToDo: [
      "Confirm the Schema scope matches your target CDM schema",
      "Choose or edit a Query template (e.g. condition_occurrence → person → observation_period)",
      "Click Run Query Plan Preview",
    ],
    whatToReview: [
      "Metadata Summary — schema scope, dialect, table counts",
      "Schema Graph — visual map of tables and their connections",
      "Hierarchy Map — join lineage traversal",
      "Code Counts — concept frequency in the source",
      "Stratified Counts — breakdowns by age, sex, or care site",
      "Report Preview — downloadable markdown/HTML report",
    ],
    outcome:
      "Understand which tables, domains, and concepts matter — and whether the source profile is plausible for your study.",
  },
  {
    number: 2,
    title: "HADES Extras",
    subtitle: "Render SQL and package artifacts",
    icon: FileCode2,
    accent: "#2DD4BF",
    description:
      "Use HADES Extras when you need SQL rendering against a target dialect, package structure inspection, or source-specific render diagnostics. This confirms your SQL and export shape before cohort building.",
    whatToDo: [
      "Enter or modify the SQL template with @cdm_schema placeholders",
      "Set the Package name for export",
      "Expand Advanced Options to configure profile, artifact mode, skeleton, and YAML",
      "Click Render Preview",
    ],
    whatToReview: [
      "Render Summary — dialect, schema substitutions applied",
      "SQL Diff Lens — template vs rendered comparison",
      "Config Summary — runner config and cohort-table bindings",
      "Operation Lineage — render stages and schema token substitutions",
      "SQL Preview — side-by-side template and rendered output",
      "Package Manifest & Bundle — export-ready artifacts",
    ],
    outcome:
      "Confirm schema substitutions are correct, the rendered SQL is valid for your dialect, and the package shape is what downstream workflows expect.",
  },
  {
    number: 3,
    title: "Cohort Ops",
    subtitle: "Build and review cohorts",
    icon: FlaskConical,
    accent: "#9B1B30",
    description:
      "Assemble a cohort workflow from existing Parthenon cohorts, Atlas/WebAPI IDs, a cohort table, or a raw JSON definition. Apply set operations and matching, then hand off to CO2 Modules.",
    whatToDo: [
      "Click the Operation Builder card to open the configuration dialog",
      "Select the import path (Parthenon cohorts, Atlas, cohort table, or JSON)",
      "Choose one or more cohorts and set the operation type (union, intersect, subtract)",
      "Configure matching strategy, covariates, ratio, and caliper",
      "Set the export target, then click Apply Builder",
      "Click Run Cohort Preview",
    ],
    whatToReview: [
      "Compile Summary — source-backed cohort counts",
      "Attrition Funnel — step-by-step filtering visualization",
      "Matching Review — eligible/matched/excluded rows and balance score",
      "Operation Evidence — retained vs excluded row counts",
      "Selected Cohorts — Parthenon cohorts chosen in the builder",
      "Export Summary — handoff readiness indicator",
    ],
    outcome:
      "When the derived cohort looks correct, click Hand Off to CO2 Modules. This passes the cohort context (reference, row counts, operation type) to the analysis step and advances the workflow.",
    handoff: true,
  },
  {
    number: 4,
    title: "CO2 Modules",
    subtitle: "Run downstream analysis",
    icon: Radar,
    accent: "#C9A227",
    description:
      "Receives the cohort handoff and runs a downstream analysis module. Choose from 8 module families covering comparative effectiveness, phenome-wide scans, burden analysis, utilization, genomics, and more.",
    whatToDo: [
      "Confirm the cohort label (auto-populated from Cohort Ops handoff)",
      "Select the Module family (comparative effectiveness, CodeWAS, GWAS, etc.)",
      "Set the Outcome name and any module-specific parameters",
      "Click Run Module Preview",
    ],
    whatToReview: [
      "Analysis Summary — module metadata and CDM-backed counts",
      "Forest Plot — effect size estimates with confidence intervals",
      "Top Signals — leading concepts by event frequency",
      "Heatmap — subgroup intensity visualization",
      "Time Profile — temporal analysis slices",
      "Overlap Matrix — cohort overlap percentages",
      "Execution Timeline — stage-by-stage timing",
    ],
    outcome:
      "Verify the chosen module family matches your study question and that the analysis evidence is directionally plausible for your source and cohort.",
  },
];

const moduleDescriptions = [
  {
    name: "Comparative effectiveness",
    description: "Standard target-vs-comparator analysis with hazard ratios and forest plots",
  },
  {
    name: "CodeWAS preview",
    description: "Phenome-wide code scan across all condition, procedure, and drug domains",
  },
  {
    name: "timeCodeWAS preview",
    description: "Temporal phenotype trajectory analysis with configurable time windows",
  },
  {
    name: "Condition burden",
    description: "Condition occurrence frequency and burden scoring across the cohort",
  },
  {
    name: "Cohort demographics",
    description: "Age, sex, and care site demographic breakdowns with stratification",
  },
  {
    name: "Drug utilization",
    description: "Exposure window analysis for drug patterns and utilization trends",
  },
  {
    name: "GWAS preview",
    description: "Genome-wide association preview using Regenie, logistic, or linear methods",
  },
  {
    name: "Sex stratified preview",
    description: "Sex-stratified effect analysis for outcome differences across sex groups",
  },
];

export default function WorkbenchHelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/workbench"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Workbench
          </Link>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">
            Workbench Help
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            The Workbench provides source-scoped previews for four FINNGEN
            tools. They are designed to be used together in sequence — but
            you can jump to any step if you already know your cohort and
            analysis path.
          </p>
        </div>
        <a
          href="/docs/community-workbench-sdk"
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-2 text-sm font-medium text-[#B9FFF1] transition-colors hover:bg-[#2DD4BF]/20"
        >
          <BookOpen className="h-3.5 w-3.5" />
          SDK Docs
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* ── Workflow overview ────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Recommended Workflow
        </h2>
        <div className="flex items-center justify-between gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: `${step.accent}22`,
                      color: step.accent,
                      border: `2px solid ${step.accent}`,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-200">
                      {step.title}
                    </div>
                    <div className="text-[11px] text-zinc-600">
                      {step.subtitle}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 ? (
                  <ArrowRight className="mx-2 h-4 w-4 shrink-0 text-zinc-700" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Step details ─────────────────────────────────────────── */}
      {steps.map((step) => {
        const Icon = step.icon;
        return (
          <div
            key={step.number}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
          >
            <div className="mb-4 flex items-start gap-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  backgroundColor: `${step.accent}22`,
                  color: step.accent,
                }}
              >
                {step.number}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {step.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {step.description}
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* What to do */}
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <Lightbulb size={13} />
                  What to do
                </div>
                <ol className="space-y-2">
                  {step.whatToDo.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-300">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* What to review */}
              <div>
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  What to review
                </div>
                <ul className="space-y-1.5">
                  {step.whatToReview.map((item, i) => {
                    const [label, ...rest] = item.split(" — ");
                    return (
                      <li key={i} className="text-sm">
                        <span className="font-medium text-zinc-200">
                          {label}
                        </span>
                        {rest.length ? (
                          <span className="text-zinc-500">
                            {" "}
                            — {rest.join(" — ")}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Outcome */}
            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Outcome
              </div>
              <p className="mt-1 text-sm leading-relaxed text-zinc-300">
                {step.outcome}
              </p>
            </div>

            {/* Handoff callout */}
            {step.handoff ? (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-4 py-3">
                <ArrowRight
                  className="h-4 w-4 shrink-0"
                  style={{ color: "#E85A6B" }}
                />
                <p className="text-sm text-[#F0EDE8]">
                  <span className="font-medium">Handoff:</span> The{" "}
                  <span className="font-semibold">
                    Hand Off to CO2 Modules
                  </span>{" "}
                  button transfers the cohort context (reference, row
                  counts, operation type) and auto-advances the stepper to
                  Step 4.
                </p>
              </div>
            ) : null}
          </div>
        );
      })}

      {/* ── CO2 Module families ──────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          CO2 Module Families
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {moduleDescriptions.map((mod) => (
            <div
              key={mod.name}
              className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4"
            >
              <div className="text-sm font-medium text-zinc-200">
                {mod.name}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {mod.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick tips ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Quick Tips
        </h2>
        <ul className="space-y-3">
          {[
            "Use the Toolset dropdown to switch between toolchains (currently FinnGen is the default and only available toolset).",
            "The CDM dropdown scopes all four tools to the selected data source — switching it resets run history context.",
            "Advanced Options in ROMOPAPI and HADES Extras are collapsed by default. Expand them to fine-tune domain filters, cache behavior, report format, and more.",
            "Run History at the bottom of each tab lets you inspect, replay, compare, and export prior executions without rerunning.",
            "The workflow stepper is a guide, not a gate — click any step to jump directly if you already know your path.",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2DD4BF]/15 text-xs font-semibold text-[#2DD4BF]">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-zinc-300">
                {tip}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Footer nav ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-6">
        <Link
          to="/workbench"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2DD4BF] transition-colors hover:text-[#26B8A5]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workbench
        </Link>
        <a
          href="/docs/community-workbench-sdk"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2DD4BF] transition-colors hover:text-[#26B8A5]"
        >
          Community SDK Documentation
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
