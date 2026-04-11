import { EndStrategyStep } from "../EndStrategyStep";
import { CensoringStep } from "../CensoringStep";

export function FollowUpStep() {
  return (
    <div className="flex flex-col gap-0">
      <div className="pb-5">
        <EndStrategyStep />
      </div>
      <div className="border-t border-[#2A2A30] pt-5">
        <CensoringStep />
      </div>
    </div>
  );
}
