import type { LabRange, LabStatus, LabValue } from '../types/profile';

type LabValuesTableProps = {
  values: LabValue[];
  unitName: string;
  range: LabRange | null;
};

const STATUS_LABEL: Record<LabStatus, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
  unknown: '\u2014',
};

const STATUS_CLASS: Record<LabStatus, string> = {
  low: 'text-blue-400',
  normal: 'text-text-muted',
  high: 'text-red-400',
  critical: 'text-amber-400 font-semibold',
  unknown: 'text-text-ghost',
};

export const LabValuesTable = ({ values, unitName, range }: LabValuesTableProps): React.ReactElement => {
  const rangeText = range ? `${range.low}\u2013${range.high} ${unitName}` : '\u2014';

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border-default text-text-ghost">
          <th className="py-1 pr-2 text-left">Date</th>
          <th className="py-1 pr-2 text-right">Value</th>
          <th className="py-1 pr-2 text-right">Range</th>
          <th className="py-1 text-right">Status</th>
        </tr>
      </thead>
      <tbody>
        {values.map((v, i) => (
          <tr key={`${v.date}-${i}`} className="border-b border-border-subtle">
            <td className="py-1 pr-2 text-text-muted">{v.date}</td>
            <td className="py-1 pr-2 text-right text-text-primary">
              {v.value != null ? v.value : '\u2014'} {unitName}
            </td>
            <td className="py-1 pr-2 text-right text-text-ghost">{rangeText}</td>
            <td className={`py-1 text-right ${STATUS_CLASS[v.status]}`}>
              {STATUS_LABEL[v.status]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
