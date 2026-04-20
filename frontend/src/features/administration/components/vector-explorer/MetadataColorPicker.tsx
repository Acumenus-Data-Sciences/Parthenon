import { useTranslation } from "react-i18next";

interface MetadataColorPickerProps {
  metadataKeys: string[];
  value: string | null;
  onChange: (field: string | null) => void;
}

export default function MetadataColorPicker({ metadataKeys, value, onChange }: MetadataColorPickerProps) {
  const { t } = useTranslation("app");

  if (metadataKeys.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-ghost">
        {t("administration.vectorExplorer.controls.colorBy")}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded border border-border-default bg-surface-base px-2 py-1 text-xs text-text-primary outline-none focus:border-accent/50"
      >
        <option value="">{t("administration.vectorExplorer.controls.modeDefault")}</option>
        {metadataKeys.map((key) => (
          <option key={key} value={key}>{key}</option>
        ))}
      </select>
    </div>
  );
}
