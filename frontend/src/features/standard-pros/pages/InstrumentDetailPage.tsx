import { useParams, Link } from "react-router-dom";
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

function OmopBadge({ coverage }: { coverage: OmopCoverage }) {
  const label = coverage === "yes" ? "Full" : coverage === "partial" ? "Partial" : "None";
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
      {label} OMOP Coverage
    </span>
  );
}

function ItemCard({ item }: { item: SurveyItemApi }) {
  const hasAnswers = item.answer_options.length > 0;

  return (
    <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
      {/* Item header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#2DD4BF]/10 shrink-0">
          <span className="text-xs font-bold font-['IBM_Plex_Mono',monospace] text-[#2DD4BF]">
            {item.item_number}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#F0EDE8] leading-relaxed">
            {item.item_text}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {item.loinc_code && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#60A5FA]/10 px-2 py-0.5 text-[10px] font-medium text-[#60A5FA]">
                <Hash size={10} />
                LOINC {item.loinc_code}
              </span>
            )}
            {item.snomed_code && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-medium text-[#F59E0B]">
                <Hash size={10} />
                SNOMED {item.snomed_code}
              </span>
            )}
            {item.subscale_name && (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#A78BFA]/10 px-2 py-0.5 text-[10px] font-medium text-[#A78BFA]">
                <Tag size={10} />
                {item.subscale_name}
              </span>
            )}
            <span className="text-[10px] text-[#5A5650] capitalize">
              {item.response_type.replace(/_/g, " ")}
            </span>
            {item.is_reverse_coded && (
              <span className="text-[10px] font-medium text-[#C9A227]">
                Reverse-coded
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
              className="flex items-center justify-between rounded-lg bg-[#0E0E11] border border-[#2A2A2F]/40 px-3 py-1.5"
            >
              <div className="flex items-center gap-2">
                {opt.option_value !== null && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[#1A1A1F] text-[10px] font-bold font-['IBM_Plex_Mono',monospace] text-[#C9A227]">
                    {Number(opt.option_value)}
                  </span>
                )}
                <span className="text-xs text-[#C5C0B8]">
                  {opt.option_text}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {opt.loinc_la_code && (
                  <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#60A5FA]">
                    {opt.loinc_la_code}
                  </span>
                )}
                {opt.snomed_code && (
                  <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#F59E0B]">
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
  const { id } = useParams<{ id: string }>();
  const instrumentId = id ? Number(id) : 0;

  const { data: instrument, isLoading, isError } = useSurveyInstrument(instrumentId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          to="/standard-pros"
          className="flex items-center gap-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Library
        </Link>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-[#8A857D]" />
          <span className="ml-2 text-sm text-[#5A5650]">Loading instrument...</span>
        </div>
      </div>
    );
  }

  if (isError || !instrument) {
    return (
      <div className="space-y-6">
        <Link
          to="/standard-pros"
          className="flex items-center gap-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Library
        </Link>
        <div className={cn(
          "flex flex-col items-center justify-center py-16 rounded-xl",
          "border border-dashed border-[#2A2A2F] bg-[#141418]",
        )}>
          <ClipboardList size={32} className="text-[#5A5650] mb-3" />
          <p className="text-sm text-[#8A857D]">Instrument not found.</p>
        </div>
      </div>
    );
  }

  const domainColor = DOMAIN_COLORS[instrument.domain] ?? "#5A5650";
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
        className="flex items-center gap-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Library
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
            <h1 className="text-2xl font-bold text-[#F0EDE8]">
              {instrument.abbreviation}
            </h1>
            <span
              className="inline-block rounded-md px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${domainColor}15`,
                color: domainColor,
              }}
            >
              {instrument.domain}
            </span>
            <OmopBadge coverage={instrument.omop_coverage as OmopCoverage} />
          </div>
          <p className="text-sm text-[#C5C0B8]">{instrument.name}</p>
          {instrument.description && (
            <p className="text-xs text-[#8A857D] mt-1 leading-relaxed">
              {instrument.description}
            </p>
          )}
        </div>
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetaCard icon={FileText} label="Items" value={String(instrument.item_count)} color="#2DD4BF" />
        <MetaCard icon={BookOpen} label="Answer Options" value={String(totalAnswerOptions)} color="#C9A227" />
        <MetaCard
          icon={Hash}
          label="LOINC Panel"
          value={instrument.loinc_panel_code ?? "\u2014"}
          color={instrument.loinc_panel_code ? "#60A5FA" : "#5A5650"}
        />
        <MetaCard
          icon={Hash}
          label="SNOMED CT"
          value={instrument.snomed_code ?? "\u2014"}
          color={instrument.snomed_code ? "#F59E0B" : "#5A5650"}
        />
        <MetaCard
          icon={instrument.is_public_domain ? Unlock : Lock}
          label="License"
          value={instrument.is_public_domain ? "Public" : "Proprietary"}
          color={instrument.is_public_domain ? "#2DD4BF" : "#C9A227"}
        />
        <MetaCard icon={Tag} label="Version" value={instrument.version} color="#8A857D" />
        <MetaCard
          icon={Beaker}
          label="Administrations"
          value={String(instrument.conduct_records_count)}
          color="#A78BFA"
        />
      </div>

      {/* Scoring method */}
      {instrument.scoring_method && (
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-5">
          <h2 className="text-sm font-medium text-[#F0EDE8] mb-3">
            Scoring Method
          </h2>
          <div className="flex flex-wrap gap-3">
            {!!instrument.scoring_method.type && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E0E11] border border-[#2A2A2F]/50 px-3 py-1.5 text-xs text-[#C5C0B8]">
                <span className="text-[10px] text-[#5A5650] uppercase">Type</span>
                <span className="font-['IBM_Plex_Mono',monospace] font-medium">
                  {String(instrument.scoring_method.type)}
                </span>
              </span>
            )}
            {!!instrument.scoring_method.range && Array.isArray(instrument.scoring_method.range) && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E0E11] border border-[#2A2A2F]/50 px-3 py-1.5 text-xs text-[#C5C0B8]">
                <span className="text-[10px] text-[#5A5650] uppercase">Range</span>
                <span className="font-['IBM_Plex_Mono',monospace] font-medium">
                  {(instrument.scoring_method.range as number[]).join("\u2013")}
                </span>
              </span>
            )}
            {!!instrument.scoring_method.subscales && Array.isArray(instrument.scoring_method.subscales) && (instrument.scoring_method.subscales as string[]).length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E0E11] border border-[#2A2A2F]/50 px-3 py-1.5 text-xs text-[#C5C0B8]">
                <span className="text-[10px] text-[#5A5650] uppercase">Subscales</span>
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
          <h2 className="text-sm font-medium text-[#F0EDE8] mb-4">
            Items ({instrument.items.length})
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
          "border border-dashed border-[#2A2A2F] bg-[#141418]",
        )}>
          <FileText size={28} className="text-[#5A5650] mb-2" />
          <p className="text-sm text-[#8A857D] mb-1">
            No items loaded for this instrument
          </p>
          <p className="text-xs text-[#5A5650]">
            {instrument.is_public_domain
              ? "Items can be added via the Survey Builder or survey:seed-library command"
              : "This is a proprietary instrument \u2014 item content requires a license"}
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
    <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} style={{ color }} />
        <p className="text-[10px] text-[#5A5650] uppercase tracking-wider">
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
