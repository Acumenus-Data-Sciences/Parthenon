// frontend/src/features/finngen-analyses/components/results/ResultViewerSwitch.tsx
import type { CO2ModuleKey, CodeWASDisplay, TimeCodeWASDisplay, OverlapsDisplay, DemographicsDisplay } from "../../types";
import { CodeWASResults } from "./CodeWASResults";
import { TimeCodeWASResults } from "./TimeCodeWASResults";
import { OverlapsResults } from "./OverlapsResults";
import { DemographicsResults } from "./DemographicsResults";
import { GenericResultViewer } from "./GenericResultViewer";

interface ResultViewerSwitchProps {
  moduleKey: CO2ModuleKey;
  display: unknown;
}

export function ResultViewerSwitch({ moduleKey, display }: ResultViewerSwitchProps) {
  switch (moduleKey) {
    case "co2.codewas":
      return <CodeWASResults display={display as CodeWASDisplay} />;
    case "co2.time_codewas":
      return <TimeCodeWASResults display={display as TimeCodeWASDisplay} />;
    case "co2.overlaps":
      return <OverlapsResults display={display as OverlapsDisplay} />;
    case "co2.demographics":
      return <DemographicsResults display={display as DemographicsDisplay} />;
    default:
      return <GenericResultViewer display={display} />;
  }
}
