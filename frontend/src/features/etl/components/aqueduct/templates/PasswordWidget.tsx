import type { WidgetProps } from "@rjsf/utils";

export function PasswordWidget(props: WidgetProps) {
  const { id, value, required, disabled, readonly, onChange, label } = props;
  return (
    <input
      id={id}
      type="password"
      aria-label={label}
      value={typeof value === "string" ? value : ""}
      required={required}
      disabled={disabled || readonly}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : e.target.value)
      }
      className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-success"
    />
  );
}
