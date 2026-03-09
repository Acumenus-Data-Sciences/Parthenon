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
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-[#5A5650] italic">No structured data available</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-px bg-[#232328] rounded-lg overflow-hidden">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <div className="bg-[#151518] px-3 py-2">
            <span className="text-xs font-medium text-[#5A5650]">
              {formatKey(key)}
            </span>
          </div>
          <div className="bg-[#151518] px-3 py-2">
            <span className="text-sm text-[#F0EDE8] break-words">
              {formatValue(value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
