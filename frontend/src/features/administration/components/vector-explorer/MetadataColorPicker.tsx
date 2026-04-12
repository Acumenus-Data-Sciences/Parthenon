interface MetadataColorPickerProps {
  metadataKeys: string[];
  value: string | null;
  onChange: (field: string | null) => void;
}

export default function MetadataColorPicker({ metadataKeys, value, onChange }: MetadataColorPickerProps) {
  if (metadataKeys.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#5A5650]">Color by</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded border border-[#232328] bg-[#0E0E11] px-2 py-1 text-xs text-[#E8E4DC] outline-none focus:border-[#C9A227]/50"
      >
        <option value="">Mode default</option>
        {metadataKeys.map((key) => (
          <option key={key} value={key}>{key}</option>
        ))}
      </select>
    </div>
  );
}
