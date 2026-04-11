import { InclusionRulesStep } from "../InclusionRulesStep";
import { DemographicsStep } from "../DemographicsStep";
import { RiskScoresStep } from "../RiskScoresStep";

export function CriteriaStep() {
  return (
    <div className="flex flex-col gap-0">
      <div className="pb-5">
        <InclusionRulesStep />
      </div>
      <div className="border-t border-[#2A2A30] pb-5 pt-5">
        <DemographicsStep />
      </div>
      <div className="border-t border-[#2A2A30] pt-5">
        <RiskScoresStep />
      </div>
    </div>
  );
}
