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
  normal: 'text-zinc-400',
  high: 'text-red-400',
  critical: 'text-amber-400 font-semibold',
  unknown: 'text-zinc-500',
};

export const LabValuesTable = ({ values, unitName, range }: LabValuesTableProps): React.ReactElement => {
  const rangeText = range ? `${range.low}\u2013${range.high} ${unitName}` : '\u2014';

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border-default text-zinc-500">
          <th className="py-1 pr-2 text-left">Date</th>
          <th className="py-1 pr-2 text-right">Value</th>
          <th className="py-1 pr-2 text-right">Range</th>
          <th className="py-1 text-right">Status</th>
        </tr>
      </thead>
      <tbody>
        {values.map((v, i) => (
          <tr key={`${v.date}-${i}`} className="border-b border-border-subtle">
            <td className="py-1 pr-2 text-zinc-400">{v.date}</td>
            <td className="py-1 pr-2 text-right text-zinc-100">
              {v.value != null ? v.value : '\u2014'} {unitName}
            </td>
            <td className="py-1 pr-2 text-right text-zinc-500">{rangeText}</td>
            <td className={`py-1 text-right ${STATUS_CLASS[v.status]}`}>
              {STATUS_LABEL[v.status]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
