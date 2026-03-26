import { X, Check, AlertTriangle, ArrowRight } from "lucide-react";
import type { EtlTableMapping } from "../../api";

interface CdmColumn {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface CdmTableDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  domain: string;
  columns: CdmColumn[];
  /** All table mappings that target this CDM table */
  mappings: EtlTableMapping[];
  onDrillDown: (mappingId: number) => void;
}

export default function CdmTableDetailModal({
  isOpen,
  onClose,
  tableName,
  domain,
  columns,
  mappings,
  onDrillDown,
}: CdmTableDetailModalProps) {
  if (!isOpen) return null;

  // Build a map of CDM column → field mapping info
  const fieldMap = new Map<string, { source_column: string; source_table: string; mapping_type: string; confidence: number | null; mapping_id: number }>();
  for (const mapping of mappings) {
    for (const fm of mapping.field_mappings ?? []) {
      fieldMap.set(fm.target_column, {
        source_column: fm.source_column ?? "(unmapped)",
        source_table: mapping.source_table,
        mapping_type: fm.mapping_type ?? "direct",
        confidence: fm.confidence ?? null,
        mapping_id: mapping.id,
      });
    }
  }

  const mapped = columns.filter((c) => fieldMap.has(c.name));
  const unmapped = columns.filter((c) => !fieldMap.has(c.name));
  const unmappedRequired = unmapped.filter((c) => c.required);
  const unmappedOptional = unmapped.filter((c) => !c.required);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-xl border border-[#232328] bg-[#151518] shadow-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#232328]">
            <div>
              <h2 className="text-lg font-semibold text-[#F0EDE8]">{tableName}</h2>
              <p className="text-xs text-[#8A857D] mt-0.5">
                {domain} &middot; {columns.length} columns &middot; {mapped.length} mapped &middot; {unmapped.length} unmapped
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-[#5A5650] hover:text-[#F0EDE8]">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Unmapped required — highlight */}
            {unmappedRequired.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium text-[#E85A6B] mb-2">
                  <AlertTriangle size={14} />
                  Unmapped Required ({unmappedRequired.length})
                </h3>
                <div className="rounded-lg border border-[#E85A6B]/30 divide-y divide-[#E85A6B]/10">
                  {unmappedRequired.map((col) => (
                    <div key={col.name} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-[#E85A6B]">{col.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E85A6B]/15 text-[#E85A6B]">{col.type}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E85A6B]/15 text-[#E85A6B] font-medium">REQUIRED</span>
                      </div>
                      <p className="text-xs text-[#5A5650] mt-1 line-clamp-2">{col.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mapped columns */}
            {mapped.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium text-[#2DD4BF] mb-2">
                  <Check size={14} />
                  Mapped ({mapped.length})
                </h3>
                <div className="rounded-lg border border-[#232328] divide-y divide-[#1E1E23]">
                  {mapped.map((col) => {
                    const fm = fieldMap.get(col.name)!;
                    return (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => { onDrillDown(fm.mapping_id); onClose(); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-[#1C1C20] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-[#C5C0B8]">{fm.source_table}.{fm.source_column}</span>
                          <ArrowRight size={12} className="text-[#5A5650]" />
                          <span className="text-sm font-mono font-medium text-[#2DD4BF]">{col.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#232328] text-[#8A857D]">{fm.mapping_type}</span>
                          {col.required && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2DD4BF]/15 text-[#2DD4BF]">req</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unmapped optional */}
            {unmappedOptional.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[#8A857D] mb-2">
                  Unmapped Optional ({unmappedOptional.length})
                </h3>
                <div className="rounded-lg border border-[#232328] divide-y divide-[#1E1E23]">
                  {unmappedOptional.map((col) => (
                    <div key={col.name} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-[#5A5650]">{col.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#232328] text-[#5A5650]">{col.type}</span>
                      </div>
                      <p className="text-xs text-[#3A3630] mt-1 line-clamp-1">{col.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
