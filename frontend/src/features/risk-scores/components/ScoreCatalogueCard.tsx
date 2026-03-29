import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskScoreModel, ScoreEligibility } from "../types/riskScore";

interface ScoreCatalogueCardProps {
  score: RiskScoreModel;
  color: string;
  eligibility: ScoreEligibility | undefined;
  sourceSelected: boolean;
  onCreateAnalysis: (scoreId: string) => void;
}

export function ScoreCatalogueCard({
  score,
  color,
  eligibility,
  sourceSelected,
  onCreateAnalysis,
}: ScoreCatalogueCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isEligible = eligibility?.eligible === true;
  const patientCount = eligibility?.patient_count ?? 0;
  const missingComponents = eligibility?.missing ?? [];

  return (
    <div
      className={cn(
        "rounded-lg border bg-[#151518] transition-all",
        expanded ? "border-[#323238]" : "border-[#232328] hover:border-[#323238]",
      )}
    >
      {/* Card Header — always visible, clickable */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="font-['IBM_Plex_Mono',monospace] text-[10px] px-1.5 py-0.5 rounded shrink-0"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {score.score_id}
              </span>
              <h3 className="text-sm font-medium text-[#F0EDE8] truncate">
                {score.score_name}
              </h3>
            </div>
            <p className="text-xs text-[#8A857D] line-clamp-2">
              {score.description}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {/* Eligibility badge */}
            {sourceSelected && eligibility && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  isEligible
                    ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                    : "bg-[#5A5650]/10 text-[#5A5650]",
                )}
              >
                {isEligible ? (
                  <>
                    <CheckCircle2 size={10} />
                    {patientCount.toLocaleString()} eligible
                  </>
                ) : (
                  <>
                    <XCircle size={10} />
                    Insufficient data
                  </>
                )}
              </span>
            )}
            {expanded ? (
              <ChevronUp size={14} className="text-[#5A5650]" />
            ) : (
              <ChevronDown size={14} className="text-[#5A5650]" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#232328] pt-3">
          {/* Eligible Population */}
          <div>
            <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
              Eligible Population
            </p>
            <p className="text-xs text-[#C5C0B8]">
              {score.eligible_population}
            </p>
          </div>

          {/* Required Components */}
          {score.required_components.length > 0 && (
            <div>
              <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
                Required Components
              </p>
              <div className="flex flex-wrap gap-1.5">
                {score.required_components.map((comp) => (
                  <span
                    key={comp}
                    className="inline-block rounded bg-[#1A1A1F] border border-[#2A2A2F] px-2 py-1 text-[10px] text-[#C5C0B8] font-['IBM_Plex_Mono',monospace]"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk Tiers */}
          {Object.keys(score.risk_tiers).length > 0 && (
            <div>
              <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
                Risk Tiers
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(score.risk_tiers).map(([tier, bounds]) => (
                  <span
                    key={tier}
                    className="inline-flex items-center gap-1 rounded bg-[#1A1A1F] border border-[#2A2A2F] px-2 py-1 text-[10px] text-[#C5C0B8]"
                  >
                    <span className="font-medium">{tier.replace(/_/g, " ")}</span>
                    <span className="text-[#5A5650]">
                      [{bounds[0] ?? "−∞"}, {bounds[1] ?? "∞"})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Required Tables */}
          {score.required_tables.length > 0 && (
            <div>
              <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
                CDM Tables Used
              </p>
              <div className="flex flex-wrap gap-1.5">
                {score.required_tables.map((t) => (
                  <span
                    key={t}
                    className="inline-block rounded bg-[#1A1A1F] px-1.5 py-0.5 text-[9px] text-[#5A5650] font-['IBM_Plex_Mono',monospace]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Eligibility Detail (if source selected) */}
          {sourceSelected && eligibility && !isEligible && missingComponents.length > 0 && (
            <div className="rounded-lg border border-[#C9A227]/20 bg-[#C9A227]/5 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={12} className="text-[#C9A227]" />
                <p className="text-[10px] font-medium text-[#C9A227] uppercase tracking-wider">
                  Missing Data
                </p>
              </div>
              <ul className="text-xs text-[#C9A227]/80 space-y-0.5">
                {missingComponents.map((m) => (
                  <li key={m}>• {m}</li>
                ))}
              </ul>
            </div>
          )}

          {!sourceSelected && (
            <div className="rounded-lg border border-[#C9A227]/20 bg-[#C9A227]/5 px-3 py-2">
              <p className="text-xs text-[#C9A227]">
                Select a data source to check eligibility.
              </p>
            </div>
          )}

          {/* Action */}
          {sourceSelected && isEligible && (
            <button
              type="button"
              onClick={() => onCreateAnalysis(score.score_id)}
              className="flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-3 py-2 text-xs font-medium text-white hover:bg-[#B42240] transition-colors"
            >
              <Plus size={12} />
              Create Analysis with {score.score_name}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
