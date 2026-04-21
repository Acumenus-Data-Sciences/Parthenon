import { useState } from "react";
import { useTranslation } from "react-i18next";
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

type Tab = "library" | "coverage" | "builder" | "conduct" | "analytics";

/* ── Stats bar ───────────────────────────────────────────────────────── */

function StatsBar({ stats, isLoading }: { stats: SurveyStatsApi | undefined; isLoading: boolean }) {
  const { t } = useTranslation("app");
  const items = [
    { label: t("standardPros.page.stats.instruments"), value: stats?.total_instruments ?? 0, icon: Library, color: "var(--success)" },
    { label: t("standardPros.page.stats.withItems"), value: stats?.instruments_with_items ?? 0, icon: CheckCircle2, color: "var(--accent)" },
    { label: t("standardPros.page.stats.questionItems"), value: stats?.total_items ?? 0, icon: FileText, color: "var(--info)" },
    { label: t("standardPros.page.stats.answerOptions"), value: stats?.total_answer_options ?? 0, icon: BookOpen, color: "var(--domain-observation)" },
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
  const { t } = useTranslation("app");
  const analyses = [
    { id: "900", title: t("standardPros.page.analytics.analyses.a900Title"), desc: t("standardPros.page.analytics.analyses.a900Desc") },
    { id: "901", title: t("standardPros.page.analytics.analyses.a901Title"), desc: t("standardPros.page.analytics.analyses.a901Desc") },
    { id: "902", title: t("standardPros.page.analytics.analyses.a902Title"), desc: t("standardPros.page.analytics.analyses.a902Desc") },
    { id: "903", title: t("standardPros.page.analytics.analyses.a903Title"), desc: t("standardPros.page.analytics.analyses.a903Desc") },
    { id: "904", title: t("standardPros.page.analytics.analyses.a904Title"), desc: t("standardPros.page.analytics.analyses.a904Desc") },
    { id: "905", title: t("standardPros.page.analytics.analyses.a905Title"), desc: t("standardPros.page.analytics.analyses.a905Desc") },
    { id: "906", title: t("standardPros.page.analytics.analyses.a906Title"), desc: t("standardPros.page.analytics.analyses.a906Desc") },
    { id: "907", title: t("standardPros.page.analytics.analyses.a907Title"), desc: t("standardPros.page.analytics.analyses.a907Desc") },
    { id: "908", title: t("standardPros.page.analytics.analyses.a908Title"), desc: t("standardPros.page.analytics.analyses.a908Desc") },
    { id: "909", title: t("standardPros.page.analytics.analyses.a909Title"), desc: t("standardPros.page.analytics.analyses.a909Desc") },
  ];

  const dqChecks = [
    { id: "DQ-S01", title: t("standardPros.page.analytics.checks.dqS01Title"), desc: t("standardPros.page.analytics.checks.dqS01Desc") },
    { id: "DQ-S02", title: t("standardPros.page.analytics.checks.dqS02Title"), desc: t("standardPros.page.analytics.checks.dqS02Desc") },
    { id: "DQ-S03", title: t("standardPros.page.analytics.checks.dqS03Title"), desc: t("standardPros.page.analytics.checks.dqS03Desc") },
    { id: "DQ-S04", title: t("standardPros.page.analytics.checks.dqS04Title"), desc: t("standardPros.page.analytics.checks.dqS04Desc") },
    { id: "DQ-S05", title: t("standardPros.page.analytics.checks.dqS05Title"), desc: t("standardPros.page.analytics.checks.dqS05Desc") },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-accent/30 bg-accent/5 px-5 py-4">
        <Info size={16} className="text-accent shrink-0" />
        <p className="text-sm text-accent">
          {t("standardPros.page.analytics.requiresData")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Achilles 900-series */}
        <div className="rounded-xl border border-border-default bg-surface-raised p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">
            {t("standardPros.page.analytics.achillesTitle")}
          </h3>
          <div className="space-y-2">
            {analyses.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg bg-surface-base border border-border-default/50 px-3 py-2"
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
        <div className="rounded-xl border border-border-default bg-surface-raised p-5">
          <h3 className="text-sm font-medium text-text-primary mb-4">
            {t("standardPros.page.analytics.dqTitle")}
          </h3>
          <div className="space-y-2">
            {dqChecks.map((dq) => (
              <div
                key={dq.id}
                className="flex items-start gap-3 rounded-lg bg-surface-base border border-border-default/50 px-3 py-2.5"
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
              {t("standardPros.page.analytics.requiresSurveyData")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function StandardProsPage() {
  const { t } = useTranslation("app");
  const [tab, setTab] = useState<Tab>("library");
  const [showAbout, setShowAbout] = useState(false);
  const { data: stats, isLoading: statsLoading } = useSurveyStats();
  const { data: liveInstruments, isLoading: instrumentsLoading } =
    useSurveyInstrumentsAsProList();

  const instruments = liveInstruments ?? INSTRUMENTS;
  const tabs = [
    { id: "library" as const, label: t("standardPros.page.tabs.library"), icon: Library },
    { id: "coverage" as const, label: t("standardPros.page.tabs.coverage"), icon: PieChart },
    { id: "builder" as const, label: t("standardPros.page.tabs.builder"), icon: Wrench },
    { id: "conduct" as const, label: t("standardPros.page.tabs.conduct"), icon: ClipboardList },
    { id: "analytics" as const, label: t("standardPros.page.tabs.analytics"), icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0"
          style={{ backgroundColor: "color-mix(in srgb, var(--success) 15%, transparent)" }}
        >
          <ClipboardList size={18} style={{ color: "var(--success)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              {t("standardPros.page.title")}
            </h1>
            {stats && !statsLoading && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                {t("standardPros.page.live")}
              </span>
            )}
            {instrumentsLoading && (
              <Loader2 size={14} className="animate-spin text-text-ghost" />
            )}
          </div>
          <p className="text-sm text-text-muted">
            {t("standardPros.page.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAbout(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-light transition-colors shrink-0"
        >
          <Info size={14} />
          {t("standardPros.page.aboutButton")}
        </button>
      </div>

      {/* Stats bar */}
      <StatsBar stats={stats} isLoading={statsLoading} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-default">
        {tabs.map(({ id, label, icon: Icon }) => (
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
