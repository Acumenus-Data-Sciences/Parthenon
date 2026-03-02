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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PrimaryCriteriaPanel } from "./PrimaryCriteriaPanel";
import { InclusionCriteriaPanel } from "./InclusionCriteriaPanel";
import { EndStrategyEditor } from "./EndStrategyEditor";
import { DemographicFilterEditor } from "./DemographicFilterEditor";
import { DomainCriteriaSelector, getDomainInfo } from "./DomainCriteriaSelector";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import type {
  DomainCriterionType,
  DomainCriterion,
  DemographicFilter,
} from "../types/cohortExpression";

interface SectionProps {
  title: string;
  icon: React.ElementType;
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
  } = useCohortExpressionStore();

  const [showAddCensor, setShowAddCensor] = useState(false);

  const primaryCount = expression.PrimaryCriteria.CriteriaList.length;
  const inclusionCount =
    (expression.AdditionalCriteria?.CriteriaList.length ?? 0) +
    (expression.AdditionalCriteria?.Groups.length ?? 0);
  const censorCount = expression.CensoringCriteria?.length ?? 0;
  const conceptSetCount = expression.ConceptSets.length;
  const demographicCount = expression.DemographicCriteria?.length ?? 0;

  const handleAddDemographic = () => {
    const current = expression.DemographicCriteria ?? [];
    setDemographicCriteria([...current, {}]);
  };

  const handleUpdateDemographic = (index: number, filter: DemographicFilter) => {
    const current = [...(expression.DemographicCriteria ?? [])];
    current[index] = filter;
    setDemographicCriteria(current);
  };

  const handleRemoveDemographic = (index: number) => {
    const current = [...(expression.DemographicCriteria ?? [])];
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

          {(expression.DemographicCriteria ?? []).map((filter, i) => (
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

      {/* 7. Qualified Limit */}
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
