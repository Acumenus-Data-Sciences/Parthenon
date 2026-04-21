import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ClipboardList,
  Check,
  X,
  Minus,
  Loader2,
  BookOpen,
  Hash,
  Tag,
  Lock,
  Unlock,
  FileText,
  Beaker,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSurveyInstrument } from "../hooks/useSurveyInstruments";
import { DOMAIN_COLORS, OMOP_COLORS } from "../types/proInstrument";
import type { OmopCoverage } from "../types/proInstrument";
import type { SurveyItemApi } from "../api/surveyApi";
import {
  standardProsCatalogDomainLabel,
  standardProsLicenseLabel,
  standardProsOmopLabel,
  standardProsResponseTypeLabel,
} from "../lib/i18n";

function OmopBadge({ coverage }: { coverage: OmopCoverage }) {
  const { t } = useTranslation("app");
  const label = standardProsOmopLabel(t, coverage);
  const Icon = coverage === "yes" ? Check : coverage === "partial" ? Minus : X;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${OMOP_COLORS[coverage]}15`,
        color: OMOP_COLORS[coverage],
      }}
    >
      <Icon size={12} />
      {t("standardPros.instrumentDetail.omopCoverage", { coverage: label })}
    </span>
  );
}

function ItemCard({ item }: { item: SurveyItemApi }) {
  const { t } = useTranslation("app");
  const hasAnswers = item.answer_options.length > 0;

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-5">
      {/* Item header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-success/10 shrink-0">
          <span className="text-xs font-bold font-['IBM_Plex_Mono',monospace] text-success">
            {item.item_number}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary leading-relaxed">
            {item.item_text}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {item.loinc_code && (
              <span className="inline-flex items-center gap-1 rounded-md bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info">
                <Hash size={10} />
                {t("standardPros.instrumentDetail.loinc")} {item.loinc_code}
              </span>
            )}
            {item.snomed_code && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                <Hash size={10} />
                {t("standardPros.instrumentDetail.snomed")} {item.snomed_code}
              </span>
            )}
            {item.subscale_name && (
              <span className="inline-flex items-center gap-1 rounded-md bg-domain-observation/10 px-2 py-0.5 text-[10px] font-medium text-domain-observation">
                <Tag size={10} />
                {item.subscale_name}
              </span>
            )}
            <span className="text-[10px] text-text-ghost capitalize">
              {standardProsResponseTypeLabel(t, item.response_type)}
            </span>
            {item.is_reverse_coded && (
              <span className="text-[10px] font-medium text-accent">
                {t("standardPros.instrumentDetail.reverseCoded")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Answer options */}
      {hasAnswers && (
        <div className="ml-10 space-y-1">
          {item.answer_options.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center justify-between rounded-lg bg-surface-base border border-border-default/40 px-3 py-1.5"
            >
              <div className="flex items-center gap-2">
                {opt.option_value !== null && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-surface-overlay text-[10px] font-bold font-['IBM_Plex_Mono',monospace] text-accent">
                    {Number(opt.option_value)}
                  </span>
                )}
                <span className="text-xs text-text-secondary">
                  {opt.option_text}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {opt.loinc_la_code && (
                  <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-info">
                    {opt.loinc_la_code}
                  </span>
                )}
                {opt.snomed_code && (
                  <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-warning">
                    {opt.snomed_code}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InstrumentDetailPage() {
  const { t } = useTranslation("app");
  const { id } = useParams<{ id: string }>();
  const instrumentId = id ? Number(id) : 0;

  const { data: instrument, isLoading, isError } = useSurveyInstrument(instrumentId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          to="/standard-pros"
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          {t("standardPros.instrumentDetail.backToLibrary")}
        </Link>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-text-muted" />
          <span className="ml-2 text-sm text-text-ghost">
            {t("standardPros.common.loadingInstrument")}
          </span>
        </div>
      </div>
    );
  }

  if (isError || !instrument) {
    return (
      <div className="space-y-6">
        <Link
          to="/standard-pros"
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          {t("standardPros.instrumentDetail.backToLibrary")}
        </Link>
        <div className={cn(
          "flex flex-col items-center justify-center py-16 rounded-xl",
          "border border-dashed border-border-default bg-surface-raised",
        )}>
          <ClipboardList size={32} className="text-text-ghost mb-3" />
          <p className="text-sm text-text-muted">{t("standardPros.instrumentDetail.notFound")}</p>
        </div>
      </div>
    );
  }

  const domainColor = DOMAIN_COLORS[instrument.domain] ?? "var(--text-ghost)";
  const hasItems = instrument.items.length > 0;
  const totalAnswerOptions = instrument.items.reduce(
    (sum, item) => sum + item.answer_options.length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/standard-pros"
        className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        {t("standardPros.instrumentDetail.backToLibrary")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
          style={{ backgroundColor: `${domainColor}18` }}
        >
          <ClipboardList size={22} style={{ color: domainColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-text-primary">
              {instrument.abbreviation}
            </h1>
            <span
              className="inline-block rounded-md px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${domainColor}15`,
                color: domainColor,
              }}
            >
              {standardProsCatalogDomainLabel(t, instrument.domain)}
            </span>
            <OmopBadge coverage={instrument.omop_coverage as OmopCoverage} />
          </div>
          <p className="text-sm text-text-secondary">{instrument.name}</p>
          {instrument.description && (
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              {instrument.description}
            </p>
          )}
        </div>
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetaCard icon={FileText} label={t("standardPros.common.items")} value={String(instrument.item_count)} color="var(--success)" />
        <MetaCard icon={BookOpen} label={t("standardPros.common.answerOptions")} value={String(totalAnswerOptions)} color="var(--accent)" />
        <MetaCard
          icon={Hash}
          label={t("standardPros.instrumentDetail.loincPanel")}
          value={instrument.loinc_panel_code ?? "\u2014"}
          color={instrument.loinc_panel_code ? "var(--info)" : "var(--text-ghost)"}
        />
        <MetaCard
          icon={Hash}
          label={t("standardPros.instrumentDetail.snomedCt")}
          value={instrument.snomed_code ?? "\u2014"}
          color={instrument.snomed_code ? "var(--warning)" : "var(--text-ghost)"}
        />
        <MetaCard
          icon={instrument.is_public_domain ? Unlock : Lock}
          label={t("standardPros.common.license")}
          value={standardProsLicenseLabel(
            t,
            instrument.is_public_domain ? "public" : "proprietary",
          )}
          color={instrument.is_public_domain ? "var(--success)" : "var(--accent)"}
        />
        <MetaCard icon={Tag} label={t("standardPros.common.version")} value={instrument.version} color="var(--text-muted)" />
        <MetaCard
          icon={Beaker}
          label={t("standardPros.instrumentDetail.administrations")}
          value={String(instrument.conduct_records_count)}
          color="var(--domain-observation)"
        />
      </div>

      {/* Scoring method */}
      {instrument.scoring_method && (
        <div className="rounded-xl border border-border-default bg-surface-raised p-5">
          <h2 className="text-sm font-medium text-text-primary mb-3">
            {t("standardPros.instrumentDetail.scoringMethod")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {!!instrument.scoring_method.type && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-base border border-border-default/50 px-3 py-1.5 text-xs text-text-secondary">
                <span className="text-[10px] text-text-ghost uppercase">{t("standardPros.instrumentDetail.type")}</span>
                <span className="font-['IBM_Plex_Mono',monospace] font-medium">
                  {String(instrument.scoring_method.type)}
                </span>
              </span>
            )}
            {!!instrument.scoring_method.range && Array.isArray(instrument.scoring_method.range) && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-base border border-border-default/50 px-3 py-1.5 text-xs text-text-secondary">
                <span className="text-[10px] text-text-ghost uppercase">{t("standardPros.instrumentDetail.range")}</span>
                <span className="font-['IBM_Plex_Mono',monospace] font-medium">
                  {(instrument.scoring_method.range as number[]).join("\u2013")}
                </span>
              </span>
            )}
            {!!instrument.scoring_method.subscales && Array.isArray(instrument.scoring_method.subscales) && (instrument.scoring_method.subscales as string[]).length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-base border border-border-default/50 px-3 py-1.5 text-xs text-text-secondary">
                <span className="text-[10px] text-text-ghost uppercase">{t("standardPros.instrumentDetail.subscales")}</span>
                <span className="font-['IBM_Plex_Mono',monospace] font-medium">
                  {(instrument.scoring_method.subscales as string[]).join(", ")}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      {hasItems ? (
        <div>
          <h2 className="text-sm font-medium text-text-primary mb-4">
            {t("standardPros.instrumentDetail.itemsHeading", {
              count: instrument.items.length,
            })}
          </h2>
          <div className="space-y-3">
            {instrument.items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className={cn(
          "flex flex-col items-center justify-center py-12 rounded-xl",
          "border border-dashed border-border-default bg-surface-raised",
        )}>
          <FileText size={28} className="text-text-ghost mb-2" />
          <p className="text-sm text-text-muted mb-1">
            {t("standardPros.instrumentDetail.noItemsTitle")}
          </p>
          <p className="text-xs text-text-ghost">
            {instrument.is_public_domain
              ? t("standardPros.instrumentDetail.noItemsPublic")
              : t("standardPros.instrumentDetail.noItemsProprietary")}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function MetaCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} style={{ color }} />
        <p className="text-[10px] text-text-ghost uppercase tracking-wider">
          {label}
        </p>
      </div>
      <p
        className="text-lg font-semibold font-['IBM_Plex_Mono',monospace]"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
