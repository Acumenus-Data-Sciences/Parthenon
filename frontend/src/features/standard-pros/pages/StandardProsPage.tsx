import { useState } from "react";
import {
  ClipboardList,
  BookOpen,
  Wrench,
  BarChart3,
  FileText,
  Loader2,
  CheckCircle2,
  Library,
  PieChart,
  Info,
} from "lucide-react";
import { INSTRUMENTS } from "../data/instruments";
import { InstrumentTable } from "../components/InstrumentTable";
import { CoverageChart } from "../components/CoverageChart";
import { AboutProsModal } from "../components/AboutProsModal";
import { BuilderTab } from "../components/builder/BuilderTab";
import { ConductTab } from "../components/conduct/ConductTab";
import { useSurveyStats, useSurveyInstrumentsAsProList } from "../hooks/useSurveyInstruments";
import type { SurveyStatsApi } from "../api/surveyApi";

/* ── Tabs ────────────────────────────────────────────────────────────── */

const TABS = [
  { id: "library", label: "Instrument Library", icon: Library },
  { id: "coverage", label: "Coverage Analytics", icon: PieChart },
  { id: "builder", label: "Survey Builder", icon: Wrench },
  { id: "conduct", label: "Survey Conduct", icon: ClipboardList },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;
type Tab = (typeof TABS)[number]["id"];

/* ── Stats bar ───────────────────────────────────────────────────────── */

function StatsBar({ stats, isLoading }: { stats: SurveyStatsApi | undefined; isLoading: boolean }) {
  const items = [
    { label: "Instruments", value: stats?.total_instruments ?? 0, icon: Library, color: "var(--success)" },
    { label: "With Items", value: stats?.instruments_with_items ?? 0, icon: CheckCircle2, color: "var(--accent)" },
    { label: "Question Items", value: stats?.total_items ?? 0, icon: FileText, color: "var(--info)" },
    { label: "Answer Options", value: stats?.total_answer_options ?? 0, icon: BookOpen, color: "var(--domain-observation)" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-4 py-3"
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0"
            style={{ backgroundColor: `${item.color}18` }}
          >
            <item.icon size={16} style={{ color: item.color }} />
          </div>
          <div>
            <p
              className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
              style={{ color: item.color }}
            >
              {isLoading ? "\u2014" : item.value}
            </p>
            <p className="text-[10px] text-text-ghost uppercase tracking-wider">
              {item.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Analytics placeholder ───────────────────────────────────────────── */

function AnalyticsTab() {
  const analyses = [
    { id: "900", title: "Survey Response Census", desc: "Persons with survey responses, by instrument" },
    { id: "901", title: "Completion Over Time", desc: "Completed surveys by instrument and time period" },
    { id: "902", title: "Item Completion Rates", desc: "Skip rate detection per item" },
    { id: "903", title: "Score Distributions", desc: "By instrument and subscale" },
    { id: "904", title: "Floor/Ceiling Effects", desc: "Min/max score clustering" },
    { id: "905", title: "Longitudinal Trajectories", desc: "Score change over time" },
    { id: "906", title: "Response Time", desc: "Completion duration distributions" },
    { id: "907", title: "Administration Mode", desc: "By respondent type and mode" },
    { id: "908", title: "Missing Data Patterns", desc: "Most frequently skipped items" },
    { id: "909", title: "Temporal Alignment", desc: "Survey-to-clinical-event gaps" },
  ];

  const dqChecks = [
    { id: "DQ-S01", title: "Orphaned Responses", desc: "Survey-typed observations without survey_conduct" },
    { id: "DQ-S02", title: "Out-of-Range Values", desc: "Scores outside valid instrument range" },
    { id: "DQ-S03", title: "Fast Completion", desc: "Implausibly short completion times" },
    { id: "DQ-S04", title: "Straight-Line", desc: "All items answered identically" },
    { id: "DQ-S05", title: "Mapping Completeness", desc: "% items mapped to standard concepts" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-accent/30 bg-accent/5 px-5 py-4">
        <Info size={16} className="text-accent shrink-0" />
        <p className="text-sm text-accent">
          Analytics require survey_conduct data. Administer surveys through the Conduct tab to populate results.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Achilles 900-series */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">
            Achilles 900-Series Analyses
          </h3>
          <div className="space-y-2">
            {analyses.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg bg-surface-base border border-[#2A2A2F]/50 px-3 py-2"
              >
                <span className="text-[10px] font-['IBM_Plex_Mono',monospace] font-bold text-success shrink-0 pt-0.5">
                  {a.id}
                </span>
                <div>
                  <span className="text-xs font-medium text-text-primary">{a.title}</span>
                  <p className="text-[11px] text-text-muted">{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DQ checks */}
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">
            Data Quality Checks
          </h3>
          <div className="space-y-2">
            {dqChecks.map((dq) => (
              <div
                key={dq.id}
                className="flex items-start gap-3 rounded-lg bg-surface-base border border-[#2A2A2F]/50 px-3 py-2.5"
              >
                <span className="text-[10px] font-['IBM_Plex_Mono',monospace] font-bold text-accent shrink-0 pt-0.5">
                  {dq.id}
                </span>
                <div>
                  <span className="text-xs font-medium text-text-primary">{dq.title}</span>
                  <p className="text-[11px] text-text-muted">{dq.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col items-center py-8">
            <BarChart3 size={28} className="text-text-ghost mb-2" />
            <span className="inline-block rounded-md bg-accent/10 px-3 py-1 text-[10px] font-medium text-accent uppercase tracking-wider">
              Requires Survey Data
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function StandardProsPage() {
  const [tab, setTab] = useState<Tab>("library");
  const [showAbout, setShowAbout] = useState(false);
  const { data: stats, isLoading: statsLoading } = useSurveyStats();
  const { data: liveInstruments, isLoading: instrumentsLoading } =
    useSurveyInstrumentsAsProList();

  const instruments = liveInstruments ?? INSTRUMENTS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0"
          style={{ backgroundColor: "color-mix(in srgb, var(--success) 9%, transparent)" }}
        >
          <ClipboardList size={18} style={{ color: "var(--success)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              Standard PROs+
            </h1>
            {stats && !statsLoading && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
            )}
            {instrumentsLoading && (
              <Loader2 size={14} className="animate-spin text-text-ghost" />
            )}
          </div>
          <p className="text-sm text-text-muted">
            Pre-mapped survey instrument library, visual builder, and dedicated PRO analytics
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAbout(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-[#B42240] transition-colors shrink-0"
        >
          <Info size={14} />
          About PROs+
        </button>
      </div>

      {/* Stats bar */}
      <StatsBar stats={stats} isLoading={statsLoading} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-default">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id
                ? "border-success text-success"
                : "border-transparent text-text-ghost hover:text-text-muted"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "library" && <InstrumentTable instruments={instruments} />}
      {tab === "coverage" && <CoverageChart instruments={instruments} />}
      {tab === "builder" && <BuilderTab />}
      {tab === "conduct" && <ConductTab />}
      {tab === "analytics" && <AnalyticsTab />}

      {/* About modal */}
      {showAbout && (
        <AboutProsModal
          onClose={() => setShowAbout(false)}
          stats={{
            total: stats?.total_instruments ?? INSTRUMENTS.length,
            domains: stats?.domains ?? new Set(INSTRUMENTS.map((i) => i.domain)).size,
            withLoinc: stats?.with_loinc ?? INSTRUMENTS.filter((i) => i.hasLoinc).length,
            fullOmop: stats?.full_omop ?? INSTRUMENTS.filter((i) => i.omopCoverage === "yes").length,
            partialOmop: stats?.partial_omop ?? INSTRUMENTS.filter((i) => i.omopCoverage === "partial").length,
            noOmop: stats?.no_omop ?? INSTRUMENTS.filter((i) => i.omopCoverage === "no").length,
            publicDomain: stats?.public_domain ?? INSTRUMENTS.filter((i) => i.license === "public").length,
          }}
        />
      )}
    </div>
  );
}
