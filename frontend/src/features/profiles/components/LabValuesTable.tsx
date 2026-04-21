import { useTranslation } from "react-i18next";
import type { LabRange, LabStatus, LabValue } from '../types/profile';
import { formatDate as formatAppDate } from "@/i18n/format";
import { getLabStatusLabel } from "../lib/i18n";

type LabValuesTableProps = {
  values: LabValue[];
  unitName: string;
  range: LabRange | null;
};

const STATUS_CLASS: Record<LabStatus, string> = {
  low: 'text-blue-400',
  normal: 'text-text-muted',
  high: 'text-red-400',
  critical: 'text-amber-400 font-semibold',
  unknown: 'text-text-ghost',
};

export const LabValuesTable = ({ values, unitName, range }: LabValuesTableProps): React.ReactElement => {
  const { t } = useTranslation("app");
  const rangeText = range ? `${range.low}\u2013${range.high} ${unitName}` : '\u2014';

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border-default text-text-ghost">
          <th className="py-1 pr-2 text-left">{t("profiles.common.table.date")}</th>
          <th className="py-1 pr-2 text-right">{t("profiles.common.table.value")}</th>
          <th className="py-1 pr-2 text-right">{t("profiles.common.table.range")}</th>
          <th className="py-1 text-right">{t("profiles.common.table.status")}</th>
        </tr>
      </thead>
      <tbody>
        {values.map((v, i) => (
          <tr key={`${v.date}-${i}`} className="border-b border-border-subtle">
            <td className="py-1 pr-2 text-text-muted">
              {formatAppDate(v.date, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </td>
            <td className="py-1 pr-2 text-right text-text-primary">
              {v.value != null ? v.value : '\u2014'} {unitName}
            </td>
            <td className="py-1 pr-2 text-right text-text-ghost">{rangeText}</td>
            <td className={`py-1 text-right ${STATUS_CLASS[v.status]}`}>
              {v.status === "unknown" ? "\u2014" : getLabStatusLabel(t, v.status)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
