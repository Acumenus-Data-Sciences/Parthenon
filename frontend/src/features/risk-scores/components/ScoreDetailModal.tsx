import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Play,
} from "lucide-react";
import type { RiskScoreModel, ScoreEligibility } from "../types/riskScore";
import { TIER_COLORS } from "../types/riskScore";

interface ScoreDetailModalProps {
  score: RiskScoreModel;
  color: string;
  eligibility: ScoreEligibility | undefined;
  sourceSelected: boolean;
  onClose: () => void;
  onCreateAnalysis: (scoreId: string) => void;
  onRunSingle: (scoreId: string) => void;
}

export function ScoreDetailModal({
  score,
  color,
  eligibility,
  sourceSelected,
  onClose,
  onCreateAnalysis,
  onRunSingle,
}: ScoreDetailModalProps) {
  const isEligible = eligibility?.eligible === true;
  const patientCount = eligibility?.patient_count ?? 0;
  const missingComponents = eligibility?.missing ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border border-[#2A2A2F] bg-[#0E0E11] shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-[#232328] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2">
              <Activity size={18} style={{ color }} />
              <span
                className="font-['IBM_Plex_Mono',monospace] text-xs px-2 py-0.5 rounded"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {score.score_id}
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium"
                style={{ backgroundColor: `${color}10`, color }}
              >
                {score.category}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-[#F0EDE8]">
              {score.score_name}
            </h2>
            <p className="text-sm text-[#8A857D] mt-1">
              {score.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5A5650] hover:text-[#C5C0B8] transition-colors shrink-0 mt-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Eligibility Status — prominent */}
          {!sourceSelected ? (
            <div className="rounded-lg border border-[#C9A227]/20 bg-[#C9A227]/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#C9A227]" />
                <p className="text-sm text-[#C9A227]">
                  Select a data source from the header to check eligibility.
                </p>
              </div>
            </div>
          ) : eligibility && isEligible ? (
            <div className="rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#2DD4BF]" />
                <p className="text-sm font-medium text-[#2DD4BF]">
                  Eligible — {patientCount.toLocaleString()} patients have sufficient data
                </p>
              </div>
            </div>
          ) : eligibility && !isEligible ? (
            <div className="rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <XCircle size={16} className="text-[#C9A227]" />
                <p className="text-sm font-medium text-[#C9A227]">
                  Insufficient data in the active source
                </p>
              </div>
              {missingComponents.length > 0 && (
                <div className="mt-2 ml-6">
                  <p className="text-xs text-[#C9A227]/80 mb-1">Missing:</p>
                  <ul className="text-xs text-[#C9A227]/70 space-y-0.5">
                    {missingComponents.map((m) => (
                      <li key={m}>• {m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#60A5FA]/20 bg-[#60A5FA]/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-[#60A5FA]" />
                <p className="text-sm text-[#60A5FA]">
                  Checking eligibility for the active source...
                </p>
              </div>
            </div>
          )}

          {/* Eligible Population */}
          <div>
            <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
              Eligible Population
            </p>
            <p className="text-sm text-[#C5C0B8]">
              {score.eligible_population}
            </p>
          </div>

          {/* Two-column layout for details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Required Components */}
            {score.required_components.length > 0 && (
              <div>
                <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
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

            {/* CDM Tables */}
            {score.required_tables.length > 0 && (
              <div>
                <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
                  CDM Tables Used
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {score.required_tables.map((t) => (
                    <span
                      key={t}
                      className="inline-block rounded bg-[#1A1A1F] px-2 py-1 text-[10px] text-[#5A5650] font-['IBM_Plex_Mono',monospace]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Risk Tiers */}
          {Object.keys(score.risk_tiers).length > 0 && (
            <div>
              <p className="text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
                Risk Tier Definitions
              </p>
              <div className="rounded-lg border border-[#232328] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1A1A1E]">
                      <th className="text-left px-3 py-2 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
                        Tier
                      </th>
                      <th className="text-left px-3 py-2 text-[10px] text-[#5A5650] uppercase tracking-wider font-medium">
                        Score Range
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(score.risk_tiers).map(([tier, bounds]) => {
                      const tierColor =
                        TIER_COLORS[tier] ?? "#8A857D";
                      return (
                        <tr
                          key={tier}
                          className="border-t border-[#232328]"
                        >
                          <td className="px-3 py-2">
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-medium"
                              style={{ color: tierColor }}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: tierColor }}
                              />
                              {tier.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
                            {bounds[0] ?? "−∞"} – {bounds[1] ?? "∞"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer — Actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#232328] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
          >
            Close
          </button>
          <div className="flex items-center gap-2">
            {sourceSelected && eligibility && isEligible && (
              <>
                <button
                  type="button"
                  onClick={() => onRunSingle(score.score_id)}
                  className="btn btn-ghost btn-sm flex items-center gap-1.5"
                >
                  <Play size={12} />
                  Quick Run
                </button>
                <button
                  type="button"
                  onClick={() => onCreateAnalysis(score.score_id)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#9B1B30] px-4 py-2 text-xs font-medium text-text-primary hover:bg-[#B42240] transition-colors"
                >
                  <Plus size={12} />
                  Create Analysis
                </button>
              </>
            )}
            {sourceSelected && eligibility && !isEligible && (
              <span className="text-xs text-[#5A5650]">
                Not eligible for the active source
              </span>
            )}
            {sourceSelected && !eligibility && (
              <span className="text-xs text-[#60A5FA]">
                Checking eligibility...
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
