import { useTranslation } from "react-i18next";

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

interface StructuredDataBlockProps {
  data: Record<string, unknown>;
}

export default function StructuredDataBlock({
  data,
}: StructuredDataBlockProps) {
  const { t } = useTranslation("app");
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-text-ghost italic">
        {t("publish.structuredData.empty")}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-px bg-surface-elevated rounded-lg overflow-hidden">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <div className="bg-surface-raised px-3 py-2">
            <span className="text-xs font-medium text-text-ghost">
              {formatKey(key)}
            </span>
          </div>
          <div className="bg-surface-raised px-3 py-2">
            <span className="text-sm text-text-primary break-words">
              {formatValue(value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
