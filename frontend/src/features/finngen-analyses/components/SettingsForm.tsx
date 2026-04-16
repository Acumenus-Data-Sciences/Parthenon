// frontend/src/features/finngen-analyses/components/SettingsForm.tsx
import { useMemo } from "react";
import Form from "@rjsf/core";
import type { RJSFSchema, UiSchema, WidgetProps, RegistryWidgetsType } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import { CohortPicker } from "./widgets/CohortPicker";
import { TemporalWindowBuilder } from "./widgets/TemporalWindowBuilder";
import { CovariateSelector } from "./widgets/CovariateSelector";
import type { CO2ModuleKey } from "../types";

const CUSTOM_WIDGETS: RegistryWidgetsType = {
  CohortPicker: CohortPicker as unknown as React.ComponentType<WidgetProps>,
  TemporalWindowBuilder: TemporalWindowBuilder as unknown as React.ComponentType<WidgetProps>,
  CovariateSelector: CovariateSelector as unknown as React.ComponentType<WidgetProps>,
};

// Frontend-only uiSchema per module (maps field names to custom widgets)
const UI_SCHEMAS: Record<CO2ModuleKey, UiSchema> = {
  "co2.codewas": {
    case_cohort_id: { "ui:widget": "CohortPicker" },
    control_cohort_id: { "ui:widget": "CohortPicker" },
  },
  "co2.time_codewas": {
    case_cohort_id: { "ui:widget": "CohortPicker" },
    control_cohort_id: { "ui:widget": "CohortPicker" },
    time_windows: { "ui:widget": "TemporalWindowBuilder" },
  },
  "co2.overlaps": {
    cohort_ids: { "ui:widget": "CohortPicker" },
  },
  "co2.demographics": {
    cohort_ids: { "ui:widget": "CohortPicker" },
  },
};

interface SettingsFormProps {
  moduleKey: CO2ModuleKey;
  schema: Record<string, unknown>;
  defaultValues: Record<string, unknown>;
  onSubmit: (formData: Record<string, unknown>) => void;
  isPending: boolean;
}

export function SettingsForm({
  moduleKey,
  schema,
  defaultValues,
  onSubmit,
  isPending,
}: SettingsFormProps) {
  const rjsfSchema = useMemo(() => {
    // Strip ui:widget hints from the schema (those go in uiSchema only)
    const cleaned = JSON.parse(JSON.stringify(schema));
    if (cleaned.properties) {
      for (const prop of Object.values(cleaned.properties) as Record<string, unknown>[]) {
        delete prop["ui:widget"];
      }
    }
    return cleaned as RJSFSchema;
  }, [schema]);

  const uiSchema = UI_SCHEMAS[moduleKey] ?? {};

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <Form
        schema={rjsfSchema}
        uiSchema={uiSchema}
        formData={defaultValues}
        validator={validator}
        widgets={CUSTOM_WIDGETS}
        onSubmit={({ formData }) => {
          if (formData) onSubmit(formData as Record<string, unknown>);
        }}
        className="rjsf-finngen"
      >
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded bg-success px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-success/90 disabled:opacity-50"
          >
            {isPending ? "Dispatching..." : "Run Analysis"}
          </button>
          <button
            type="button"
            onClick={() => {
              // RJSF doesn't have a built-in reset — we trigger a form re-render
              // by setting the formData prop, but that requires lifting state.
              // For SP3, a page reload or re-selecting the module resets.
            }}
            className="rounded border border-border-default px-3 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Reset
          </button>
        </div>
      </Form>
    </div>
  );
}
