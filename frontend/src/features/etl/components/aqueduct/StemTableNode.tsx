import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useTranslation } from "react-i18next";

export interface StemTableNodeData {
  tableName: string;
  columnCount: number;
  routingRules: number;
}

function StemTableNodeComponent({ data }: NodeProps) {
  const { t } = useTranslation("app");
  const d = data as unknown as StemTableNodeData;
  return (
    <div className="rounded-lg border-2 border-dashed border-domain-observation bg-surface-overlay px-4 py-3 min-w-[180px]">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-domain-observation !border-domain-observation" />
      <div className="text-sm font-semibold text-domain-observation">
        {t("etl.aqueduct.nodes.stemTitle")}
      </div>
      <div className="text-xs text-text-muted mt-1">
        {t("etl.aqueduct.nodes.stemSummary", {
          columns: d.columnCount,
          routes: d.routingRules,
        })}
      </div>
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-domain-observation !border-domain-observation" />
    </div>
  );
}

export const StemTableNode = memo(StemTableNodeComponent);
