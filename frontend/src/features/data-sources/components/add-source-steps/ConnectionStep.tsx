import { useState } from "react";
import { Info } from "lucide-react";

export interface ConnectionData {
  source_name: string;
  source_key: string;
  source_connection: string;
  is_cache_enabled: boolean;
}

interface Props {
  data: ConnectionData;
  onChange: (data: ConnectionData) => void;
}

function toScreamingSnakeCase(str: string): string {
  return str
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function ConnectionStep({ data, onChange }: Props) {
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);

  function handleNameChange(name: string) {
    const update: ConnectionData = { ...data, source_name: name };
    if (!keyManuallyEdited) {
      update.source_key = toScreamingSnakeCase(name);
    }
    onChange(update);
  }

  function handleKeyChange(key: string) {
    setKeyManuallyEdited(true);
    onChange({ ...data, source_key: key.toUpperCase().replace(/[^A-Z0-9_-]/g, "") });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#F0EDE8]">Connection Details</h2>
        <p className="mt-1 text-sm text-[#8A857D]">
          Configure how Parthenon identifies and connects to this source.
        </p>
      </div>

      {/* Source Name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#C5C0B8]">
          Source Name <span className="text-[#E85A6B]">*</span>
        </label>
        <input
          type="text"
          value={data.source_name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Acumenus Production CDM"
          className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:border-[#C9A227] focus:outline-none"
        />
      </div>

      {/* Source Key */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#C5C0B8]">
          Source Key <span className="text-[#E85A6B]">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={data.source_key}
            onChange={(e) => handleKeyChange(e.target.value)}
            placeholder="ACUMENUS_PROD"
            className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 font-mono text-sm text-[#C9A227] placeholder-[#5A5650] focus:border-[#C9A227] focus:outline-none"
          />
        </div>
        <p className="flex items-center gap-1 text-xs text-[#5A5650]">
          <Info size={10} />
          Used internally as a stable identifier — cannot be changed after creation.
        </p>
      </div>

      {/* Laravel Connection Name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[#C5C0B8]">
          Laravel Connection Name <span className="text-[#E85A6B]">*</span>
        </label>
        <input
          type="text"
          value={data.source_connection}
          onChange={(e) => onChange({ ...data, source_connection: e.target.value })}
          placeholder="cdm"
          className="w-full rounded-lg border border-[#232328] bg-[#0E0E11] px-3 py-2 font-mono text-sm text-[#F0EDE8] placeholder-[#5A5650] focus:border-[#C9A227] focus:outline-none"
        />
        <p className="flex items-center gap-1 text-xs text-[#5A5650]">
          <Info size={10} />
          Must match a named database connection in config/database.php (e.g. cdm, eunomia, pgsql).
        </p>
      </div>

      {/* Cache Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-[#232328] bg-[#0E0E11] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[#C5C0B8]">Enable Query Cache</p>
          <p className="text-xs text-[#5A5650]">Cache Achilles results for faster dashboard loads</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...data, is_cache_enabled: !data.is_cache_enabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ${
            data.is_cache_enabled ? "border-[#C9A227] bg-[#C9A227]" : "border-[#323238] bg-[#323238]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
              data.is_cache_enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
