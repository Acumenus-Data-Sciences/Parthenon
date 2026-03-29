import { useMemo } from "react";
import {
  ClipboardList,
  AlertTriangle,
  Layers,
  Database,
  BarChart3,
  Wrench,
  BookOpen,
  Lock,
  Unlock,
  Code2,
  Beaker,
  ArrowRight,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { INSTRUMENTS } from "../data/instruments";
import { PAIN_POINTS, PILLARS } from "../types/proInstrument";
import { InstrumentTable } from "../components/InstrumentTable";
import { CoverageChart } from "../components/CoverageChart";
import { useSurveyStats, useSurveyInstrumentsAsProList } from "../hooks/useSurveyInstruments";

/* ── Stats: prefer live API, fall back to static data ────────────── */
function useStats() {
  const { data: apiStats, isError } = useSurveyStats();

  return useMemo(() => {
    if (apiStats && !isError) {
      return {
        total: apiStats.total_instruments,
        domains: apiStats.domains,
        withLoinc: apiStats.with_loinc,
        fullOmop: apiStats.full_omop,
        partialOmop: apiStats.partial_omop,
        noOmop: apiStats.no_omop,
        publicDomain: apiStats.public_domain,
        instrumentsWithItems: apiStats.instruments_with_items,
        totalItems: apiStats.total_items,
        totalAnswerOptions: apiStats.total_answer_options,
        isLive: true,
      };
    }
    const total = INSTRUMENTS.length;
    const domains = new Set(INSTRUMENTS.map((i) => i.domain)).size;
    const withLoinc = INSTRUMENTS.filter((i) => i.hasLoinc).length;
    const fullOmop = INSTRUMENTS.filter((i) => i.omopCoverage === "yes").length;
    const partialOmop = INSTRUMENTS.filter(
      (i) => i.omopCoverage === "partial",
    ).length;
    const noOmop = INSTRUMENTS.filter((i) => i.omopCoverage === "no").length;
    const publicDomain = INSTRUMENTS.filter(
      (i) => i.license === "public",
    ).length;
    return {
      total,
      domains,
      withLoinc,
      fullOmop,
      partialOmop,
      noOmop,
      publicDomain,
      instrumentsWithItems: 0,
      totalItems: 0,
      totalAnswerOptions: 0,
      isLive: false,
    };
  }, [apiStats, isError]);
}

/* ── Pain point icon map ────────────────────────────────────────────── */
const PAIN_ICONS = [BookOpen, Wrench, Layers, Database, BarChart3, Beaker];

/* ── Roadmap phases ─────────────────────────────────────────────────── */
const PHASES = [
  {
    phase: 1,
    title: "Foundation",
    duration: "4 weeks",
    items: [
      "Database migrations (5 survey tables)",
      "Eloquent models with relationships",
      "API endpoints for instrument CRUD",
      "PTHN_SURVEY vocabulary registration",
      "survey:seed-library Artisan command",
    ],
  },
  {
    phase: 2,
    title: "Instrument Library & Mapping",
    duration: "6 weeks",
    items: [
      "Curate 100-instrument JSON manifest",
      "Create PTHN_SURVEY custom concepts",
      "Build concept_relationship hierarchies",
      "Frontend Library Browser (TanStack Table)",
      "Instrument Detail page",
    ],
  },
  {
    phase: 3,
    title: "Survey Builder & AI Mapping",
    duration: "4 weeks",
    items: [
      "Visual Builder wizard (create/edit/version)",
      "ATHENA concept search integration",
      "Abby AI concept suggestion engine",
      "REDCap / FHIR / CSV import",
    ],
  },
  {
    phase: 4,
    title: "Analytics & Data Quality",
    duration: "3 weeks",
    items: [
      "Achilles analyses 900\u2013909",
      "DQD checks DQ-S01 through DQ-S05",
      "Survey Results Explorer",
      "Solr survey configset",
    ],
  },
  {
    phase: 5,
    title: "Survey Conduct & ETL",
    duration: "3 weeks",
    items: [
      "Survey conduct API",
      "Auto-scoring service",
      "ETL pipeline \u2192 observation rows",
      "FHIR QuestionnaireResponse export",
      "v6.0 forward-migration script",
    ],
  },
];

/* ── Page ────────────────────────────────────────────────────────────── */
export default function StandardProsPage() {
  const stats = useStats();
  const { data: liveInstruments, isLoading: instrumentsLoading } =
    useSurveyInstrumentsAsProList();

  const instruments = liveInstruments ?? INSTRUMENTS;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO
         ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0"
            style={{ backgroundColor: "#2DD4BF18" }}
          >
            <ClipboardList size={18} style={{ color: "#2DD4BF" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#F0EDE8]">
                Standard PROs+
              </h1>
              {stats.isLive && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#2DD4BF]/10 px-2 py-0.5 text-[10px] font-medium text-[#2DD4BF]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] animate-pulse" />
                  Live
                </span>
              )}
              {instrumentsLoading && (
                <Loader2 size={14} className="animate-spin text-[#5A5650]" />
              )}
            </div>
            <p className="text-sm text-[#8A857D]">
              The first turnkey Survey &amp; Patient-Reported Outcome platform in
              the OHDSI ecosystem. Pre-mapped instruments, visual builders, and
              dedicated analytics \u2014 addressing a decade-old gap in the OMOP CDM.
            </p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard
            label="Instruments"
            value={String(stats.total)}
            accent="#2DD4BF"
          />
          <StatCard
            label="Domains"
            value={String(stats.domains)}
            accent="#C9A227"
          />
          <StatCard
            label="LOINC Coded"
            value={String(stats.withLoinc)}
            accent="#2DD4BF"
          />
          <StatCard
            label="Full OMOP"
            value={String(stats.fullOmop)}
            accent="#2DD4BF"
          />
          <StatCard
            label="Partial OMOP"
            value={String(stats.partialOmop)}
            accent="#C9A227"
          />
          <StatCard
            label="No OMOP"
            value={String(stats.noOmop)}
            accent="#E85A6B"
          />
          <StatCard
            label="Public Domain"
            value={String(stats.publicDomain)}
            accent="#60A5FA"
          />
        </div>

        {/* Live data bonus stats */}
        {stats.isLive && (stats.totalItems > 0 || stats.totalAnswerOptions > 0) && (
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-[#5A5650]">
              <span className="font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">{stats.instrumentsWithItems}</span> instruments with full items
            </span>
            <span className="text-xs text-[#5A5650]">
              <span className="font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">{stats.totalItems}</span> question items
            </span>
            <span className="text-xs text-[#5A5650]">
              <span className="font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">{stats.totalAnswerOptions}</span> answer options
            </span>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE PROBLEM
         ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={AlertTriangle}
          iconColor="#E85A6B"
          title="The Problem"
          subtitle="Six core pain points that have persisted for over a decade in the OHDSI ecosystem"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAIN_POINTS.map((pp, idx) => {
            const Icon = PAIN_ICONS[idx];
            return (
              <div
                key={pp.id}
                className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5 hover:bg-[#1A1A1F] transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#E85A6B]/10">
                    <Icon size={16} className="text-[#E85A6B]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#5A5650]">
                      Pain Point {pp.id}
                    </span>
                    <h3 className="text-sm font-semibold text-[#F0EDE8]">
                      {pp.title}
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-[#8A857D] leading-relaxed">
                  {pp.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE SOLUTION: FOUR PILLARS
         ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={Lightbulb}
          iconColor="#C9A227"
          title="The Parthenon Solution"
          subtitle="Four pillars addressing the full lifecycle of survey/PRO data"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.id}
              className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6 hover:bg-[#1A1A1F] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                  style={{ backgroundColor: `${pillar.color}15` }}
                >
                  <span
                    className="text-lg font-bold font-['IBM_Plex_Mono',monospace]"
                    style={{ color: pillar.color }}
                  >
                    {pillar.id}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[#F0EDE8] mb-0.5">
                    {pillar.title}
                  </h3>
                  <p
                    className="text-[10px] font-medium mb-2"
                    style={{ color: pillar.color }}
                  >
                    {pillar.subtitle}
                  </p>
                  <p className="text-xs text-[#8A857D] leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          COVERAGE ANALYTICS
         ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={BarChart3}
          iconColor="#60A5FA"
          title="Coverage Analytics"
          subtitle="OMOP concept coverage, LOINC availability, and license distribution across 100 instruments"
        />
        <CoverageChart instruments={instruments} />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          INSTRUMENT LIBRARY
         ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={BookOpen}
          iconColor="#2DD4BF"
          title="Instrument Library"
          subtitle="100 pre-mapped survey instruments across 16+ clinical domains with concept mappings, scoring algorithms, and license metadata"
        />
        <InstrumentTable instruments={instruments} />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DATABASE ARCHITECTURE
         ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={Database}
          iconColor="#A78BFA"
          title="Technical Architecture"
          subtitle="Five new app-schema tables preserving CDM purity while enabling rich survey management"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              table: "app.survey_instruments",
              description:
                "Instrument registry: name, version, domain, scoring method, LOINC panel code, OMOP concept, license status",
              color: "#2DD4BF",
            },
            {
              table: "app.survey_items",
              description:
                "Individual questions: item text, response type, OMOP concept, subscale, reverse-coding, value range",
              color: "#C9A227",
            },
            {
              table: "app.survey_answer_options",
              description:
                "Answer choices: option text, numeric score, OMOP concept, LOINC LA code, display order",
              color: "#60A5FA",
            },
            {
              table: "app.survey_conduct",
              description:
                "Administration metadata: respondent type, mode, completion status, visit linkage, auto-scored totals",
              color: "#A78BFA",
            },
            {
              table: "app.survey_responses",
              description:
                "Bridge table linking survey_conduct to observation rows with item-level values",
              color: "#E85A6B",
            },
          ].map((schema) => (
            <div
              key={schema.table}
              className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Code2 size={14} style={{ color: schema.color }} />
                <h3 className="text-xs font-semibold font-['IBM_Plex_Mono',monospace] text-[#F0EDE8]">
                  {schema.table}
                </h3>
              </div>
              <p className="text-xs text-[#8A857D] leading-relaxed">
                {schema.description}
              </p>
            </div>
          ))}
          {/* Forward compatibility note */}
          <div className="rounded-xl border border-dashed border-[#C9A227]/30 bg-[#C9A227]/5 p-5 flex items-start gap-3">
            <ArrowRight
              size={16}
              className="text-[#C9A227] shrink-0 mt-0.5"
            />
            <div>
              <h3 className="text-xs font-semibold text-[#C9A227] mb-1">
                CDM v6.0 Forward-Compatible
              </h3>
              <p className="text-xs text-[#8A857D] leading-relaxed">
                app.survey_conduct mirrors v6.0's native SURVEY_CONDUCT table.
                A migration script will promote records when v6.0 tooling
                matures.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ACHILLES 900-SERIES
         ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={Beaker}
          iconColor="#2DD4BF"
          title="Survey Analytics (900-Series)"
          subtitle="Dedicated Achilles analyses and data quality checks for survey characterization"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Achilles analyses */}
          <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
            <h3 className="text-sm font-medium text-[#F0EDE8] mb-4">
              New Achilles Analyses
            </h3>
            <div className="space-y-2">
              {[
                ["900", "Persons with survey responses, by instrument"],
                ["901", "Completed surveys by instrument and time period"],
                ["902", "Item completion rates (skip rate detection)"],
                ["903", "Score distributions by instrument and subscale"],
                ["904", "Floor/ceiling effects (min/max clustering)"],
                ["905", "Longitudinal score trajectories"],
                ["906", "Response time distributions"],
                ["907", "Administration by respondent type and mode"],
                ["908", "Missing data patterns"],
                ["909", "Survey-to-clinical-event temporal alignment"],
              ].map(([id, desc]) => (
                <div
                  key={id}
                  className="flex items-start gap-3 rounded-lg bg-[#0E0E11] border border-[#2A2A2F]/50 px-3 py-2"
                >
                  <span className="text-[10px] font-['IBM_Plex_Mono',monospace] font-bold text-[#2DD4BF] shrink-0 pt-0.5">
                    {id}
                  </span>
                  <span className="text-xs text-[#C5C0B8]">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* DQ checks */}
          <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
            <h3 className="text-sm font-medium text-[#F0EDE8] mb-4">
              Data Quality Checks
            </h3>
            <div className="space-y-2">
              {[
                [
                  "DQ-S01",
                  "Orphaned survey responses",
                  "Observation rows with survey type but no survey_conduct record",
                ],
                [
                  "DQ-S02",
                  "Out-of-range values",
                  "Item scores outside the instrument\u2019s valid range",
                ],
                [
                  "DQ-S03",
                  "Implausibly fast completion",
                  "Total time below instrument\u2019s expected minimum",
                ],
                [
                  "DQ-S04",
                  "Straight-line responding",
                  "All items answered identically (low-effort detection)",
                ],
                [
                  "DQ-S05",
                  "Concept mapping completeness",
                  "% of items mapped to standard vs. custom/unmapped concepts",
                ],
              ].map(([id, title, desc]) => (
                <div
                  key={id}
                  className="rounded-lg bg-[#0E0E11] border border-[#2A2A2F]/50 px-3 py-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-['IBM_Plex_Mono',monospace] font-bold text-[#C9A227]">
                      {id}
                    </span>
                    <span className="text-xs font-medium text-[#F0EDE8]">
                      {title}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A857D] pl-8">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          IMPLEMENTATION ROADMAP
         ═══════════════════════════════════════════════════════════════════ */}
      <section>
        <SectionHeader
          icon={Wrench}
          iconColor="#C9A227"
          title="Implementation Roadmap"
          subtitle="Five phases delivering the full survey/PRO lifecycle \u2014 20 weeks total"
        />
        <div className="space-y-4">
          {PHASES.map((phase, idx) => (
            <div
              key={phase.phase}
              className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5"
            >
              <div className="flex items-center gap-4 mb-3">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold font-['IBM_Plex_Mono',monospace]",
                    idx === 0
                      ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                      : "bg-[#1A1A1F] text-[#8A857D]",
                  )}
                >
                  {phase.phase}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[#F0EDE8]">
                    {phase.title}
                  </h3>
                  <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#5A5650]">
                    {phase.duration}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 ml-12">
                {phase.items.map((item) => (
                  <span
                    key={item}
                    className="inline-block rounded-lg bg-[#0E0E11] border border-[#2A2A2F]/50 px-3 py-1.5 text-[11px] text-[#C5C0B8]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          KEY INSIGHTS
         ═══════════════════════════════════════════════════════════════════ */}
      <section className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
        <h2 className="text-sm font-medium text-[#F0EDE8] mb-4">
          Key Insights from Investigation
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InsightCard
            icon={Lock}
            color="#C9A227"
            title="CDM v6.0 Not Production-Ready"
            text="survey_conduct table exists in v6.0 spec but major OHDSI analytics tools don't support v6.0 yet. Parthenon bridges the gap with an app-schema implementation."
          />
          <InsightCard
            icon={Unlock}
            color="#2DD4BF"
            title="LOINC Coverage Is Sparse"
            text={`Only ${stats.withLoinc} of ${stats.total} instruments have LOINC codes. PTHN_SURVEY vocabulary fills the gap with 2.1B+ range custom concepts.`}
          />
          <InsightCard
            icon={Database}
            color="#60A5FA"
            title="Custom Concepts Block Network Studies"
            text="Each site's custom IDs (>2B range) are incompatible. A shared PTHN_SURVEY vocabulary enables multi-site PRO-inclusive studies."
          />
          <InsightCard
            icon={Beaker}
            color="#A78BFA"
            title="First OHDSI Platform with Turnkey PROs"
            text="No existing OHDSI tool offers pre-mapped instruments, a visual builder, or survey-specific analytics. Parthenon would be the first."
          />
        </div>
      </section>
    </div>
  );
}

/* ── Reusable sub-components ────────────────────────────────────────── */

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-3.5">
      <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className="text-xl font-bold font-['IBM_Plex_Mono',monospace]"
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <Icon size={20} className="shrink-0 mt-0.5" style={{ color: iconColor }} />
      <div>
        <h2 className="text-lg font-semibold text-[#F0EDE8]">{title}</h2>
        <p className="text-xs text-[#8A857D] mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  color,
  title,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-[#0E0E11] border border-[#2A2A2F]/50 p-4">
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-semibold text-[#F0EDE8] mb-1">
          {title}
        </h4>
        <p className="text-[11px] text-[#8A857D] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
