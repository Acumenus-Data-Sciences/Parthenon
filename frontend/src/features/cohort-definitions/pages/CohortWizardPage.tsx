import { useEffect } from "react";
import { CohortWizard } from "../components/wizard/CohortWizard";
import { useCohortWizardStore } from "../stores/cohortWizardStore";

export default function CohortWizardPage() {
  const reset = useCohortWizardStore((s) => s.reset);

  useEffect(() => {
    reset();
  }, [reset]);

  return <CohortWizard />;
}
