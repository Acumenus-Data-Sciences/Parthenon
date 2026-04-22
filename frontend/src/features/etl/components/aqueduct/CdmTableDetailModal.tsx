import { X, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EtlTableMapping } from "../../api";
import { getAqueductMappingTypeLabel } from "../../lib/i18n";

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
  const { t } = useTranslation("app");

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
        <div className="w-full max-w-2xl rounded-xl border border-border-default bg-surface-raised shadow-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">{tableName}</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {t("etl.aqueduct.detailModal.summary", {
                  domain,
                  columns: columns.length,
                  mapped: mapped.length,
                  unmapped: unmapped.length,
                })}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-text-ghost hover:text-text-primary">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Unmapped required — highlight */}
            {unmappedRequired.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium text-critical mb-2">
                  <AlertTriangle size={14} />
                  {t("etl.aqueduct.detailModal.unmappedRequired", {
                    count: unmappedRequired.length,
                  })}
                </h3>
                <div className="rounded-lg border border-critical/30 divide-y divide-critical/10">
                  {unmappedRequired.map((col) => (
                    <div key={col.name} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium text-critical">{col.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-critical/15 text-critical">{col.type}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-critical/15 text-critical font-medium">
                          {t("etl.aqueduct.detailModal.required")}
                        </span>
                      </div>
                      <p className="text-xs text-text-ghost mt-1 line-clamp-2">{col.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mapped columns */}
            {mapped.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium text-success mb-2">
                  <Check size={14} />
                  {t("etl.aqueduct.detailModal.mapped", { count: mapped.length })}
                </h3>
                <div className="rounded-lg border border-border-default divide-y divide-border-subtle">
                  {mapped.map((col) => {
                    const fm = fieldMap.get(col.name)!;
                    return (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => { onDrillDown(fm.mapping_id); onClose(); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-surface-overlay transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-text-secondary">{fm.source_table}.{fm.source_column}</span>
                          <ArrowRight size={12} className="text-text-ghost" />
                          <span className="text-sm font-mono font-medium text-success">{col.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted">
                            {getAqueductMappingTypeLabel(t, fm.mapping_type)}
                          </span>
                          {col.required && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success">
                              {t("etl.aqueduct.detailModal.requiredShort")}
                            </span>
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
                <h3 className="text-sm font-medium text-text-muted mb-2">
                  {t("etl.aqueduct.detailModal.unmappedOptional", {
                    count: unmappedOptional.length,
                  })}
                </h3>
                <div className="rounded-lg border border-border-default divide-y divide-border-subtle">
                  {unmappedOptional.map((col) => (
                    <div key={col.name} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-text-ghost">{col.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-ghost">{col.type}</span>
                      </div>
                      <p className="text-xs text-text-disabled mt-1 line-clamp-1">{col.description}</p>
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
