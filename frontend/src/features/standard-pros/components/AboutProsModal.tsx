import {
  X,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  standardProsPainPoints,
  standardProsPillars,
} from "../lib/i18n";

const PAIN_ICONS = [BookOpen, Wrench, Layers, Database, BarChart3, Beaker];

interface AboutProsModalProps {
  onClose: () => void;
  stats: {
    total: number;
    domains: number;
    withLoinc: number;
    fullOmop: number;
    partialOmop: number;
    noOmop: number;
    publicDomain: number;
  };
}

export function AboutProsModal({ onClose, stats }: AboutProsModalProps) {
  const { t } = useTranslation("app");
  const painPoints = standardProsPainPoints(t);
  const pillars = standardProsPillars(t);
  const phases = [
    { phase: 1, title: t("standardPros.about.roadmap.phase1Title"), duration: t("standardPros.about.roadmap.phase1Duration"), items: [t("standardPros.about.roadmap.phase1Item1"), t("standardPros.about.roadmap.phase1Item2"), t("standardPros.about.roadmap.phase1Item3"), t("standardPros.about.roadmap.phase1Item4"), t("standardPros.about.roadmap.phase1Item5")] },
    { phase: 2, title: t("standardPros.about.roadmap.phase2Title"), duration: t("standardPros.about.roadmap.phase2Duration"), items: [t("standardPros.about.roadmap.phase2Item1"), t("standardPros.about.roadmap.phase2Item2"), t("standardPros.about.roadmap.phase2Item3"), t("standardPros.about.roadmap.phase2Item4"), t("standardPros.about.roadmap.phase2Item5")] },
    { phase: 3, title: t("standardPros.about.roadmap.phase3Title"), duration: t("standardPros.about.roadmap.phase3Duration"), items: [t("standardPros.about.roadmap.phase3Item1"), t("standardPros.about.roadmap.phase3Item2"), t("standardPros.about.roadmap.phase3Item3"), t("standardPros.about.roadmap.phase3Item4")] },
    { phase: 4, title: t("standardPros.about.roadmap.phase4Title"), duration: t("standardPros.about.roadmap.phase4Duration"), items: [t("standardPros.about.roadmap.phase4Item1"), t("standardPros.about.roadmap.phase4Item2"), t("standardPros.about.roadmap.phase4Item3"), t("standardPros.about.roadmap.phase4Item4")] },
    { phase: 5, title: t("standardPros.about.roadmap.phase5Title"), duration: t("standardPros.about.roadmap.phase5Duration"), items: [t("standardPros.about.roadmap.phase5Item1"), t("standardPros.about.roadmap.phase5Item2"), t("standardPros.about.roadmap.phase5Item3"), t("standardPros.about.roadmap.phase5Item4"), t("standardPros.about.roadmap.phase5Item5")] },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-2xl border border-border-default bg-surface-base shadow-2xl">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-default bg-surface-base/95 backdrop-blur-sm px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              {t("standardPros.about.title")}
            </h2>
            <p className="text-xs text-text-muted">
              {t("standardPros.about.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-8 p-6">
          {/* ── Overview ──────────────────────────────────────────────── */}
          <section>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("standardPros.about.overviewLead")}
            </p>
            <p className="text-sm text-text-muted leading-relaxed mt-3">
              {t("standardPros.about.overviewFollowup")}
            </p>
          </section>

          {/* ── The Problem ───────────────────────────────────────────── */}
          <section>
            <SectionTitle icon={AlertTriangle} color="var(--critical)" title={t("standardPros.about.sections.problem")} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {painPoints.map((pp, idx) => {
                const Icon = PAIN_ICONS[idx];
                return (
                  <div
                    key={pp.id}
                    className="rounded-xl border border-border-default bg-surface-raised p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-critical/10">
                        <Icon size={14} className="text-critical" />
                      </div>
                      <div>
                        <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-text-ghost">
                          {t("standardPros.about.painPointLabel", { id: pp.id })}
                        </span>
                        <h3 className="text-xs font-semibold text-text-primary">
                          {pp.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      {pp.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── The Solution ──────────────────────────────────────────── */}
          <section>
            <SectionTitle icon={Lightbulb} color="var(--accent)" title={t("standardPros.about.sections.solution")} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pillars.map((pillar) => (
                <div
                  key={pillar.id}
                  className="rounded-xl border border-border-default bg-surface-raised p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                      style={{ backgroundColor: `${pillar.color}15` }}
                    >
                      <span
                        className="text-sm font-bold font-['IBM_Plex_Mono',monospace]"
                        style={{ color: pillar.color }}
                      >
                        {pillar.id}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-text-primary mb-0.5">
                        {pillar.title}
                      </h3>
                      <p
                        className="text-[10px] font-medium mb-1"
                        style={{ color: pillar.color }}
                      >
                        {pillar.subtitle}
                      </p>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Technical Architecture ─────────────────────────────────── */}
          <section>
            <SectionTitle icon={Database} color="var(--domain-observation)" title={t("standardPros.about.sections.architecture")} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { table: "app.survey_instruments", desc: t("standardPros.about.architecture.surveyInstruments"), color: "var(--success)" },
                { table: "app.survey_items", desc: t("standardPros.about.architecture.surveyItems"), color: "var(--accent)" },
                { table: "app.survey_answer_options", desc: t("standardPros.about.architecture.surveyAnswerOptions"), color: "var(--info)" },
                { table: "app.survey_conduct", desc: t("standardPros.about.architecture.surveyConduct"), color: "var(--domain-observation)" },
                { table: "app.survey_responses", desc: t("standardPros.about.architecture.surveyResponses"), color: "var(--critical)" },
              ].map((s) => (
                <div key={s.table} className="rounded-xl border border-border-default bg-surface-raised p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Code2 size={12} style={{ color: s.color }} />
                    <span className="text-[11px] font-semibold font-['IBM_Plex_Mono',monospace] text-text-primary">
                      {s.table}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">{s.desc}</p>
                </div>
              ))}
              <div className="rounded-xl border border-dashed border-accent/30 bg-accent/5 p-4 flex items-start gap-2">
                <ArrowRight size={14} className="text-accent shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-[11px] font-semibold text-accent mb-0.5">{t("standardPros.about.architecture.forwardCompatibleTitle")}</h3>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {t("standardPros.about.architecture.forwardCompatibleDesc")}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Roadmap ───────────────────────────────────────────────── */}
          <section>
            <SectionTitle icon={Wrench} color="var(--accent)" title={t("standardPros.about.sections.roadmap")} />
            <div className="space-y-3">
              {phases.map((phase, idx) => (
                <div key={phase.phase} className="rounded-xl border border-border-default bg-surface-raised p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold font-['IBM_Plex_Mono',monospace]",
                        idx === 0 ? "bg-success/15 text-success" : "bg-surface-overlay text-text-muted",
                      )}
                    >
                      {phase.phase}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-text-primary">{phase.title}</h3>
                      <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-text-ghost">{phase.duration}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 ml-9">
                    {phase.items.map((item) => (
                      <span key={item} className="inline-block rounded-md bg-surface-base border border-border-default/50 px-2.5 py-1 text-[10px] text-text-secondary">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Key Insights ──────────────────────────────────────────── */}
          <section>
            <SectionTitle icon={Beaker} color="var(--info)" title={t("standardPros.about.sections.insights")} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InsightCard
                icon={Lock}
                color="var(--accent)"
                title={t("standardPros.about.insights.v6Title")}
                text={t("standardPros.about.insights.v6Text")}
              />
              <InsightCard
                icon={Unlock}
                color="var(--success)"
                title={t("standardPros.about.insights.loincTitle")}
                text={t("standardPros.about.insights.loincText", {
                  withLoinc: stats.withLoinc,
                  total: stats.total,
                })}
              />
              <InsightCard
                icon={Database}
                color="var(--info)"
                title={t("standardPros.about.insights.customConceptsTitle")}
                text={t("standardPros.about.insights.customConceptsText")}
              />
              <InsightCard
                icon={Beaker}
                color="var(--domain-observation)"
                title={t("standardPros.about.insights.turnkeyTitle")}
                text={t("standardPros.about.insights.turnkeyText")}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function SectionTitle({
  icon: Icon,
  color,
  title,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  color: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} color={color} />
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  color,
  title,
  text,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; color?: string }>;
  color: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-default bg-surface-raised p-4">
      <div
        className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={12} color={color} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[11px] font-semibold text-text-primary mb-0.5">{title}</h4>
        <p className="text-[11px] text-text-muted leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
