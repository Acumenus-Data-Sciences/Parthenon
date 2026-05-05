import { useMemo } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type {
  RJSFSchema,
  UiSchema,
  RegistryWidgetsType,
  WidgetProps,
} from "@rjsf/utils";
import { useTranslation } from "react-i18next";
import type {
  JsonSchemaProperty,
  TemplateManifest,
} from "../../../types/templates";
import { PasswordWidget } from "./PasswordWidget";

export interface ParameterFormProps {
  manifest: TemplateManifest;
  onSubmit: (params: Record<string, unknown>) => void;
  onCancel: () => void;
  pending?: boolean;
}

function buildUiSchema(
  schema: TemplateManifest["parameters_schema"],
): UiSchema {
  const ui: UiSchema = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    const p = prop as JsonSchemaProperty;
    if (p.secret === true) {
      ui[key] = { "ui:widget": "password" };
    }
  }
  return ui;
}

const CUSTOM_WIDGETS: RegistryWidgetsType = {
  password: PasswordWidget as unknown as React.ComponentType<WidgetProps>,
};

export function ParameterForm(props: ParameterFormProps) {
  const { manifest, onSubmit, onCancel, pending = false } = props;
  const { t } = useTranslation("app");

  const uiSchema = useMemo(
    () => buildUiSchema(manifest.parameters_schema),
    [manifest.parameters_schema],
  );

  return (
    <Form
      schema={manifest.parameters_schema as RJSFSchema}
      uiSchema={uiSchema}
      validator={validator}
      widgets={CUSTOM_WIDGETS}
      disabled={pending}
      showErrorList={false}
      onSubmit={({ formData }) => {
        if (formData) onSubmit(formData as Record<string, unknown>);
        else onSubmit({});
      }}
      className="space-y-4"
    >
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-default">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg border border-border-default px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay disabled:opacity-50"
        >
          {t("aqueduct.parameterForm.cancel", { defaultValue: "Cancel" })}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-success px-5 py-2 text-sm font-medium text-surface-base hover:bg-success-dark disabled:opacity-50"
        >
          {pending
            ? t("aqueduct.parameterForm.running", {
                defaultValue: "Running...",
              })
            : t("aqueduct.parameterForm.run", { defaultValue: "Run" })}
        </button>
      </div>
    </Form>
  );
}
