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
import { PAIN_POINTS, PILLARS } from "../types/proInstrument";

const PAIN_ICONS = [BookOpen, Wrench, Layers, Database, BarChart3, Beaker];

const PHASES = [
  { phase: 1, title: "Foundation", duration: "4 weeks", items: ["Database migrations (5 survey tables)", "Eloquent models with relationships", "API endpoints for instrument CRUD", "PTHN_SURVEY vocabulary registration", "survey:seed-library Artisan command"] },
  { phase: 2, title: "Instrument Library & Mapping", duration: "6 weeks", items: ["Curate 100-instrument JSON manifest", "Create PTHN_SURVEY custom concepts", "Build concept_relationship hierarchies", "Frontend Library Browser (TanStack Table)", "Instrument Detail page"] },
  { phase: 3, title: "Survey Builder & AI Mapping", duration: "4 weeks", items: ["Visual Builder wizard (create/edit/version)", "ATHENA concept search integration", "Abby AI concept suggestion engine", "REDCap / FHIR / CSV import"] },
  { phase: 4, title: "Analytics & Data Quality", duration: "3 weeks", items: ["Achilles analyses 900\u2013909", "DQD checks DQ-S01 through DQ-S05", "Survey Results Explorer", "Solr survey configset"] },
  { phase: 5, title: "Survey Conduct & ETL", duration: "3 weeks", items: ["Survey conduct API", "Auto-scoring service", "ETL pipeline \u2192 observation rows", "FHIR QuestionnaireResponse export", "v6.0 forward-migration script"] },
];

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
              About Standard PROs+
            </h2>
            <p className="text-xs text-text-muted">
              Survey &amp; PRO data in the OMOP CDM — problem, solution, and roadmap
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
              Patient-Reported Outcomes (PROs) capture information about a patient's
              health status directly from the patient, without clinician interpretation.
              Instruments like the PHQ-9, EQ-5D, and PROMIS measures are central to
              comparative effectiveness research, value-based care, and FDA label claims.
            </p>
            <p className="text-sm text-text-muted leading-relaxed mt-3">
              Yet in the OHDSI ecosystem, these instruments have no standardized home.
              Each organization must solve concept mapping, ETL design, metadata capture,
              and analytical tooling from scratch — a gap that has persisted for over a decade.
              Parthenon Standard PROs+ is the first platform to address it.
            </p>
          </section>

          {/* ── The Problem ───────────────────────────────────────────── */}
          <section>
            <SectionTitle icon={AlertTriangle} color="var(--critical)" title="The Problem" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PAIN_POINTS.map((pp, idx) => {
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
                          Pain Point {pp.id}
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
            <SectionTitle icon={Lightbulb} color="var(--accent)" title="The Parthenon Solution" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PILLARS.map((pillar) => (
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
            <SectionTitle icon={Database} color="var(--domain-observation)" title="Technical Architecture" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { table: "app.survey_instruments", desc: "Instrument registry: name, version, domain, scoring, LOINC, OMOP concept, license", color: "var(--success)" },
                { table: "app.survey_items", desc: "Individual questions: item text, response type, OMOP concept, subscale, reverse-coding", color: "var(--accent)" },
                { table: "app.survey_answer_options", desc: "Answer choices: option text, numeric score, OMOP concept, LOINC LA code", color: "var(--info)" },
                { table: "app.survey_conduct", desc: "Administration metadata: respondent type, mode, completion status, visit linkage, scores", color: "var(--domain-observation)" },
                { table: "app.survey_responses", desc: "Bridge table linking survey_conduct to observation rows with item-level values", color: "var(--critical)" },
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
                  <h3 className="text-[11px] font-semibold text-accent mb-0.5">CDM v6.0 Forward-Compatible</h3>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    app.survey_conduct mirrors v6.0's native SURVEY_CONDUCT table. A migration script promotes records when v6.0 tooling matures.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Roadmap ───────────────────────────────────────────────── */}
          <section>
            <SectionTitle icon={Wrench} color="var(--accent)" title="Implementation Roadmap" />
            <div className="space-y-3">
              {PHASES.map((phase, idx) => (
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
            <SectionTitle icon={Beaker} color="var(--info)" title="Key Insights" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <InsightCard
                icon={Lock}
                color="var(--accent)"
                title="CDM v6.0 Not Production-Ready"
                text="survey_conduct table exists in v6.0 spec but major OHDSI analytics tools don't support v6.0 yet. Parthenon bridges the gap with an app-schema implementation."
              />
              <InsightCard
                icon={Unlock}
                color="var(--success)"
                title="LOINC Coverage Is Sparse"
                text={`Only ${stats.withLoinc} of ${stats.total} instruments have LOINC codes. PTHN_SURVEY vocabulary fills the gap with 2.1B+ range custom concepts.`}
              />
              <InsightCard
                icon={Database}
                color="var(--info)"
                title="Custom Concepts Block Network Studies"
                text="Each site's custom IDs (>2B range) are incompatible. A shared PTHN_SURVEY vocabulary enables multi-site PRO-inclusive studies."
              />
              <InsightCard
                icon={Beaker}
                color="var(--domain-observation)"
                title="First OHDSI Platform with Turnkey PROs"
                text="No existing OHDSI tool offers pre-mapped instruments, a visual builder, or survey-specific analytics. Parthenon would be the first."
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
