import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Target,
  Filter,
  Shield,
  Clock,
  Users,
  Settings,
  Plus,
  Trash2,
  Activity,
  Dna,
  ScanLine,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PrimaryCriteriaPanel } from "./PrimaryCriteriaPanel";
import { InclusionCriteriaPanel } from "./InclusionCriteriaPanel";
import { EndStrategyEditor } from "./EndStrategyEditor";
import { DemographicFilterEditor } from "./DemographicFilterEditor";
import { DomainCriteriaSelector, getDomainInfo } from "./DomainCriteriaSelector";
import { GenomicCriteriaPanel } from "@/features/genomics/components/GenomicCriteriaPanel";
import { ImagingCriteriaPanel } from "@/features/imaging/components/ImagingCriteriaPanel";
import { RiskScoreCriteriaSection } from "./RiskScoreCriteriaSection";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import type {
  DomainCriterionType,
  DomainCriterion,
  DemographicFilter,
  GenomicCriterion,
  ImagingCriterion,
} from "../types/cohortExpression";
import { useTranslation } from "react-i18next";

/** Normalize DemographicCriteria to always be an array. It can be undefined, an object, or an array. */
function asDemographicArray(dc: unknown): DemographicFilter[] {
  if (Array.isArray(dc)) return dc;
  if (dc && typeof dc === "object") return [dc as DemographicFilter];
  return [];
}

interface SectionProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  badge?: string | number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  icon: Icon,
  iconColor = "var(--text-muted)",
  badge,
  children,
  defaultOpen = false,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-surface-overlay transition-colors"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown size={14} className="text-text-muted" />
          ) : (
            <ChevronRight size={14} className="text-text-muted" />
          )}
          <Icon size={16} style={{ color: iconColor }} />
          <span className="text-sm font-semibold text-text-primary">
            {title}
          </span>
          {badge !== undefined && (
            <span className="inline-flex items-center rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
              {badge}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border-default px-4 py-4">{children}</div>
      )}
    </div>
  );
}

export function CohortExpressionEditor() {
  const { t } = useTranslation("app");
  const {
    expression,
    setEndStrategy,
    setDemographicCriteria,
    setCensoringCriteria,
    setQualifiedLimit,
    addGenomicCriterion,
    removeGenomicCriterion,
    addImagingCriterion,
    removeImagingCriterion,
  } = useCohortExpressionStore();

  const [showAddCensor, setShowAddCensor] = useState(false);
  const [showAddGenomic, setShowAddGenomic] = useState(false);
  const [showAddImaging, setShowAddImaging] = useState(false);

  const primaryCount = expression.PrimaryCriteria?.CriteriaList?.length ?? 0;
  const inclusionCount =
    (expression.AdditionalCriteria?.CriteriaList?.length ?? 0) +
    (expression.AdditionalCriteria?.Groups?.length ?? 0);
  const censorCount = expression.CensoringCriteria?.length ?? 0;
  const conceptSetCount = (expression.ConceptSets ?? expression.conceptSets)?.length ?? 0;
  const demographicCount = Array.isArray(expression.DemographicCriteria) ? expression.DemographicCriteria.length : (expression.DemographicCriteria ? 1 : 0);
  const genomicCount = expression.GenomicCriteria?.length ?? 0;
  const imagingCount = expression.ImagingCriteria?.length ?? 0;
  const riskScoreCount = expression.RiskScoreCriteria?.length ?? 0;

  const handleAddDemographic = () => {
    const current = asDemographicArray(expression.DemographicCriteria);
    setDemographicCriteria([...current, {}]);
  };

  const handleUpdateDemographic = (index: number, filter: DemographicFilter) => {
    const current = [...(asDemographicArray(expression.DemographicCriteria))];
    current[index] = filter;
    setDemographicCriteria(current);
  };

  const handleRemoveDemographic = (index: number) => {
    const current = [...(asDemographicArray(expression.DemographicCriteria))];
    current.splice(index, 1);
    setDemographicCriteria(current);
  };

  const handleAddCensor = (
    domain: DomainCriterionType,
    criterion: DomainCriterion,
  ) => {
    const current = expression.CensoringCriteria ?? [];
    setCensoringCriteria([
      ...current,
      { [domain]: criterion } as typeof current[number],
    ]);
    setShowAddCensor(false);
  };

  const handleRemoveCensor = (index: number) => {
    const current = [...(expression.CensoringCriteria ?? [])];
    current.splice(index, 1);
    setCensoringCriteria(current);
  };

  return (
    <div className="space-y-3">
      {/* 1. Concept Sets */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.conceptSets_60d8ff")}
        icon={Layers}
        iconColor="var(--accent)"
        badge={conceptSetCount}
      >
        <div className="space-y-3">
          <p className="text-xs text-text-ghost">
            {t("cohortDefinitions.auto.conceptSetsReferencedByCriteriaInThisCohort_f8bb10")}
          </p>
          {expression.ConceptSets.length > 0 ? (
            <div className="space-y-1">
              {expression.ConceptSets.map((cs) => (
                <div
                  key={cs.id}
                  className="flex items-center justify-between rounded-lg border border-border-default bg-surface-overlay px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-accent">
                      #{cs.id}
                    </span>
                    <span className="text-sm text-text-primary">{cs.name}</span>
                    <span className="text-xs text-text-ghost">
                      ({cs.expression.items.length} {t("cohortDefinitions.auto.items_fa3c71")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-text-ghost text-center py-4">
              {t("cohortDefinitions.auto.noConceptSetsYetTheyWillBeCreated_2e46e4")}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 2. Primary Criteria */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.primaryCriteria_3d2cf7")}
        icon={Target}
        iconColor="var(--success)"
        badge={primaryCount}
        defaultOpen
      >
        <PrimaryCriteriaPanel />
      </CollapsibleSection>

      {/* 3. Inclusion Criteria */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.inclusionCriteria_04899e")}
        icon={Filter}
        iconColor="var(--info)"
        badge={inclusionCount}
      >
        <InclusionCriteriaPanel />
      </CollapsibleSection>

      {/* 4. Censoring Criteria */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.censoringCriteria_be030f")}
        icon={Shield}
        iconColor="var(--critical)"
        badge={censorCount}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-ghost">
            {t("cohortDefinitions.auto.defineEventsThatWillEndAPersonS_a25741")}
          </p>

          {(expression.CensoringCriteria ?? []).length > 0 ? (
            <div className="space-y-2">
              {(expression.CensoringCriteria ?? []).map((criterion, i) => {
                const entries = Object.entries(criterion) as [
                  DomainCriterionType,
                  DomainCriterion,
                ][];
                const [domain, crit] = entries[0] ?? [null, null];
                const domainInfo = domain ? getDomainInfo(domain) : null;

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border-default bg-surface-overlay px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-text-ghost">
                        #{i + 1}
                      </span>
                      {domainInfo && (
                        <span
                          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${domainInfo.color}15`,
                            color: domainInfo.color,
                          }}
                        >
                          <domainInfo.icon size={10} />
                          {domainInfo.label}
                        </span>
                      )}
                      {crit && (
                        <span className="text-xs text-text-muted">
                          {t("cohortDefinitions.auto.conceptSet_7e97e2")}{crit.CodesetId}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCensor(i)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-critical hover:bg-critical/10 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-text-ghost text-center py-4">
              {t("cohortDefinitions.auto.noCensoringCriteriaDefined_ffb2fc")}
            </div>
          )}

          {showAddCensor ? (
            <DomainCriteriaSelector
              onAdd={handleAddCensor}
              onCancel={() => setShowAddCensor(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddCensor(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
            >
              <Plus size={14} />
              {t("cohortDefinitions.auto.addCensoringCriterion_fc792b")}
            </button>
          )}
        </div>
      </CollapsibleSection>

      {/* 5. End Strategy */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.endStrategy_12b371")}
        icon={Clock}
        iconColor="var(--accent)"
      >
        <EndStrategyEditor
          value={expression.EndStrategy}
          onChange={setEndStrategy}
        />
      </CollapsibleSection>

      {/* 6. Demographics */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.demographicCriteria_75b107")}
        icon={Users}
        iconColor="var(--domain-observation)"
        badge={demographicCount}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-ghost">
            {t("cohortDefinitions.auto.applyDemographicFiltersToTheCohortAgeGender_dad15c")}
          </p>

          {(asDemographicArray(expression.DemographicCriteria)).map((filter, i) => (
            <DemographicFilterEditor
              key={i}
              value={filter}
              onChange={(f) => handleUpdateDemographic(i, f)}
              onRemove={() => handleRemoveDemographic(i)}
            />
          ))}

          <button
            type="button"
            onClick={handleAddDemographic}
            className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"
          >
            <Plus size={14} />
            {t("cohortDefinitions.auto.addDemographicFilter_718a20")}
          </button>
        </div>
      </CollapsibleSection>

      {/* 7. Genomic Criteria (Phase 15) */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.genomicCriteria_b8b854")}
        icon={Dna}
        iconColor="var(--domain-observation)"
        badge={genomicCount > 0 ? genomicCount : undefined}
      >
        <div className="space-y-3">
          <p className="text-xs text-text-ghost">
            {t("cohortDefinitions.auto.filterCohortByMolecularFeaturesGeneMutationsTmb_709795")}
          </p>

          {(expression.GenomicCriteria ?? []).map((criterion, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-purple-700/30 bg-purple-900/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <Dna size={12} className="text-purple-400" />
                <span className="text-xs text-purple-200">{criterion.label}</span>
                <span className="text-[10px] text-purple-500 uppercase">{criterion.type.replace("_", " ")}</span>
                {criterion.exclude && <span className="text-[10px] text-red-400">EXCLUDE</span>}
              </div>
              <button onClick={() => removeGenomicCriterion(i)} className="text-text-ghost hover:text-red-400">
                <X size={12} />
              </button>
            </div>
          ))}

          {showAddGenomic ? (
            <GenomicCriteriaPanel
              onAdd={(criterion: GenomicCriterion) => {
                addGenomicCriterion(criterion);
                setShowAddGenomic(false);
              }}
              onCancel={() => setShowAddGenomic(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddGenomic(true)}
              className="flex items-center gap-2 rounded-lg border border-dashed border-purple-700/40 px-3 py-2 text-xs text-purple-400 hover:border-purple-600 hover:text-purple-300 transition-colors"
            >
              <Plus size={12} />
              {t("cohortDefinitions.auto.addGenomicCriterion_766eea")}
            </button>
          )}
        </div>
      </CollapsibleSection>

      {/* 8. Imaging Criteria (Phase 16) */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.imagingCriteria_983710")}
        icon={ScanLine}
        iconColor="var(--info)"
        badge={imagingCount > 0 ? imagingCount : undefined}
      >
        <div className="space-y-3">
          <p className="text-xs text-text-ghost">
            {t("cohortDefinitions.auto.filterCohortByImagingCharacteristicsModalityAnatomyQuantitative_08d6e7")}
          </p>

          {(expression.ImagingCriteria ?? []).map((criterion, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-cyan-700/30 bg-cyan-900/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <ScanLine size={12} className="text-cyan-400" />
                <span className="text-xs text-cyan-200">{criterion.label}</span>
                <span className="text-[10px] text-cyan-500 uppercase">{criterion.type.replace("_", " ")}</span>
                {criterion.exclude && <span className="text-[10px] text-red-400">EXCLUDE</span>}
              </div>
              <button onClick={() => removeImagingCriterion(i)} className="text-text-ghost hover:text-red-400">
                <X size={12} />
              </button>
            </div>
          ))}

          {showAddImaging ? (
            <ImagingCriteriaPanel
              onAdd={(criterion: ImagingCriterion) => {
                addImagingCriterion(criterion);
                setShowAddImaging(false);
              }}
              onCancel={() => setShowAddImaging(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddImaging(true)}
              className="flex items-center gap-2 rounded-lg border border-dashed border-cyan-700/40 px-3 py-2 text-xs text-cyan-400 hover:border-cyan-600 hover:text-cyan-300 transition-colors"
            >
              <Plus size={12} />
              {t("cohortDefinitions.auto.addImagingCriterion_58c7a4")}
            </button>
          )}
        </div>
      </CollapsibleSection>

      {/* 9. Risk Score Criteria (Phase 3) */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.riskScoreCriteria_700999")}
        icon={Activity}
        iconColor="var(--primary)"
        badge={riskScoreCount > 0 ? riskScoreCount : undefined}
      >
        <div className="space-y-3">
          <RiskScoreCriteriaSection />
        </div>
      </CollapsibleSection>

      {/* 10. Qualified Limit */}
      <CollapsibleSection
        title={t("cohortDefinitions.auto.qualifiedLimit_8e0595")}
        icon={Settings}
        iconColor="var(--text-muted)"
      >
        <div className="space-y-3">
          <p className="text-xs text-text-ghost">
            {t("cohortDefinitions.auto.controlHowManyQualifyingEventsPerPersonAre_7711cc")}
          </p>
          <div className="flex items-center gap-3">
            <label className="text-xs text-text-muted">{t("cohortDefinitions.auto.limitTo_32fec7")}</label>
            {(["First", "All"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setQualifiedLimit(type)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  expression.QualifiedLimit?.Type === type
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-surface-base text-text-ghost border border-border-default hover:text-text-muted",
                )}
              >
                {type} {t("cohortDefinitions.auto.qualifyingEvent_3e92ae")}{type === "All" ? "s" : ""}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
