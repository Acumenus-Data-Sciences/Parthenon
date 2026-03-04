import { createContext, useContext } from "react";

interface SetupWizardContextValue {
  openSetupWizard: () => void;
}

export const SetupWizardContext = createContext<SetupWizardContextValue>({
  openSetupWizard: () => {},
});

export function useSetupWizard() {
  return useContext(SetupWizardContext);
}
