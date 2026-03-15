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
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import type {
  DomainCriterionType,
  DomainCriterion,
  DemographicFilter,
  GenomicCriterion,
  ImagingCriterion,
} from "../types/cohortExpression";

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
  iconColor = "#8A857D",
  badge,
  children,
  defaultOpen = false,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-[#1C1C20] transition-colors"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown size={14} className="text-[#8A857D]" />
          ) : (
            <ChevronRight size={14} className="text-[#8A857D]" />
          )}
          <Icon size={16} style={{ color: iconColor }} />
          <span className="text-sm font-semibold text-[#F0EDE8]">
            {title}
          </span>
          {badge !== undefined && (
            <span className="inline-flex items-center rounded-full bg-[#232328] px-2 py-0.5 text-[10px] font-medium text-[#C5C0B8]">
              {badge}
            </span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-[#232328] px-4 py-4">{children}</div>
      )}
    </div>
  );
}

export function CohortExpressionEditor() {
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
        title="Concept Sets"
        icon={Layers}
        iconColor="#C9A227"
        badge={conceptSetCount}
      >
        <div className="space-y-3">
          <p className="text-xs text-[#5A5650]">
            Concept sets referenced by criteria in this cohort definition.
            They are managed inline when adding criteria.
          </p>
          {expression.ConceptSets.length > 0 ? (
            <div className="space-y-1">
              {expression.ConceptSets.map((cs) => (
                <div
                  key={cs.id}
                  className="flex items-center justify-between rounded-lg border border-[#232328] bg-[#1A1A1E] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C9A227]">
                      #{cs.id}
                    </span>
                    <span className="text-sm text-[#F0EDE8]">{cs.name}</span>
                    <span className="text-xs text-[#5A5650]">
                      ({cs.expression.items.length} items)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[#5A5650] text-center py-4">
              No concept sets yet. They will be created when you add criteria.
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 2. Primary Criteria */}
      <CollapsibleSection
        title="Primary Criteria"
        icon={Target}
        iconColor="#2DD4BF"
        badge={primaryCount}
        defaultOpen
      >
        <PrimaryCriteriaPanel />
      </CollapsibleSection>

      {/* 3. Inclusion Criteria */}
      <CollapsibleSection
        title="Inclusion Criteria"
        icon={Filter}
        iconColor="#60A5FA"
        badge={inclusionCount}
      >
        <InclusionCriteriaPanel />
      </CollapsibleSection>

      {/* 4. Censoring Criteria */}
      <CollapsibleSection
        title="Censoring Criteria"
        icon={Shield}
        iconColor="#E85A6B"
        badge={censorCount}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#5A5650]">
            Define events that will end a person's cohort membership before
            the end strategy is reached.
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
                    className="flex items-center justify-between rounded-lg border border-[#232328] bg-[#1A1A1E] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-[#5A5650]">
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
                        <span className="text-xs text-[#8A857D]">
                          Concept Set #{crit.CodesetId}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCensor(i)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A857D] hover:text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-[#5A5650] text-center py-4">
              No censoring criteria defined.
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
              className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2.5 text-sm text-[#C5C0B8] hover:bg-[#1A1A1E] hover:text-[#F0EDE8] transition-colors"
            >
              <Plus size={14} />
              Add Censoring Criterion
            </button>
          )}
        </div>
      </CollapsibleSection>

      {/* 5. End Strategy */}
      <CollapsibleSection
        title="End Strategy"
        icon={Clock}
        iconColor="#C9A227"
      >
        <EndStrategyEditor
          value={expression.EndStrategy}
          onChange={setEndStrategy}
        />
      </CollapsibleSection>

      {/* 6. Demographics */}
      <CollapsibleSection
        title="Demographic Criteria"
        icon={Users}
        iconColor="#A78BFA"
        badge={demographicCount}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#5A5650]">
            Apply demographic filters to the cohort (age, gender, race,
            ethnicity).
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
            className="inline-flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2.5 text-sm text-[#C5C0B8] hover:bg-[#1A1A1E] hover:text-[#F0EDE8] transition-colors"
          >
            <Plus size={14} />
            Add Demographic Filter
          </button>
        </div>
      </CollapsibleSection>

      {/* 7. Genomic Criteria (Phase 15) */}
      <CollapsibleSection
        title="Genomic Criteria"
        icon={Dna}
        iconColor="#A78BFA"
        badge={genomicCount > 0 ? genomicCount : undefined}
      >
        <div className="space-y-3">
          <p className="text-xs text-[#5A5650]">
            Filter cohort by molecular features: gene mutations, TMB, MSI status, gene fusions, or ClinVar pathogenicity class.
          </p>

          {(expression.GenomicCriteria ?? []).map((criterion, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-purple-700/30 bg-purple-900/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <Dna size={12} className="text-purple-400" />
                <span className="text-xs text-purple-200">{criterion.label}</span>
                <span className="text-[10px] text-purple-500 uppercase">{criterion.type.replace("_", " ")}</span>
                {criterion.exclude && <span className="text-[10px] text-red-400">EXCLUDE</span>}
              </div>
              <button onClick={() => removeGenomicCriterion(i)} className="text-gray-600 hover:text-red-400">
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
              Add Genomic Criterion
            </button>
          )}
        </div>
      </CollapsibleSection>

      {/* 8. Imaging Criteria (Phase 16) */}
      <CollapsibleSection
        title="Imaging Criteria"
        icon={ScanLine}
        iconColor="#22D3EE"
        badge={imagingCount > 0 ? imagingCount : undefined}
      >
        <div className="space-y-3">
          <p className="text-xs text-[#5A5650]">
            Filter cohort by imaging characteristics: modality, anatomy, quantitative radiomic features, AI classification labels, or radiation dose.
          </p>

          {(expression.ImagingCriteria ?? []).map((criterion, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-cyan-700/30 bg-cyan-900/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <ScanLine size={12} className="text-cyan-400" />
                <span className="text-xs text-cyan-200">{criterion.label}</span>
                <span className="text-[10px] text-cyan-500 uppercase">{criterion.type.replace("_", " ")}</span>
                {criterion.exclude && <span className="text-[10px] text-red-400">EXCLUDE</span>}
              </div>
              <button onClick={() => removeImagingCriterion(i)} className="text-gray-600 hover:text-red-400">
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
              Add Imaging Criterion
            </button>
          )}
        </div>
      </CollapsibleSection>

      {/* 9. Qualified Limit */}
      <CollapsibleSection
        title="Qualified Limit"
        icon={Settings}
        iconColor="#8A857D"
      >
        <div className="space-y-3">
          <p className="text-xs text-[#5A5650]">
            Control how many qualifying events per person are included.
          </p>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#8A857D]">Limit to</label>
            {(["First", "All"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setQualifiedLimit(type)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  expression.QualifiedLimit?.Type === type
                    ? "bg-[#2DD4BF]/15 text-[#2DD4BF] border border-[#2DD4BF]/30"
                    : "bg-[#0E0E11] text-[#5A5650] border border-[#232328] hover:text-[#8A857D]",
                )}
              >
                {type} qualifying event{type === "All" ? "s" : ""}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
