import { EntryEventsStep } from "../EntryEventsStep";
import { ObservationWindowStep } from "../ObservationWindowStep";
import { QualifyingEventsStep } from "../QualifyingEventsStep";

export function PopulationStep() {
  return (
    <div className="flex flex-col gap-0">
      <div className="pb-5">
        <EntryEventsStep />
      </div>
      <div className="border-t border-border-default pb-5 pt-5">
        <ObservationWindowStep />
      </div>
      <div className="border-t border-border-default pt-5">
        <QualifyingEventsStep />
      </div>
    </div>
  );
}
