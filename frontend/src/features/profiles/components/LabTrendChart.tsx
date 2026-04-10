import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LabGroup } from '../types/profile';
import { LabStatusDot } from './LabStatusDot';
import { LabTrendTooltip } from './LabTrendTooltip';

type LabTrendChartProps = Pick<LabGroup, 'values' | 'range' | 'unitName'> & {
  conceptName: string;
  height?: number;
};

export const LabTrendChart = ({
  values,
  range,
  unitName,
  height = 180,
}: LabTrendChartProps): React.ReactElement => {
  const data = useMemo(
    () =>
      values
        .filter((v) => v.value != null)
        .map((v) => ({
          ts: new Date(v.date).getTime(),
          value: v.value as number,
          status: v.status,
        })),
    [values],
  );

  const domain = useMemo(() => {
    if (data.length === 0) return [0, 1] as const;
    const vs = data.map((d) => d.value);
    const lo = Math.min(...vs, range?.low ?? Infinity);
    const hi = Math.max(...vs, range?.high ?? -Infinity);
    const span = hi - lo;
    const pad = span > 0 ? span * 0.1 : Math.abs(hi) * 0.05 || 1;
    return [lo - pad, hi + pad] as const;
  }, [data, range]);

  if (data.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-xs text-zinc-500">
        No numeric values to chart
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(ts: number) => format(new Date(ts), 'MMM yyyy')}
            stroke="#71717a"
            fontSize={11}
          />
          <YAxis
            domain={[domain[0], domain[1]]}
            stroke="#71717a"
            fontSize={11}
          />
          {range && (
            <ReferenceArea
              y1={range.low}
              y2={range.high}
              fill="#2DD4BF"
              fillOpacity={0.12}
              stroke="#2DD4BF"
              strokeOpacity={0.35}
              strokeDasharray="2 2"
              ifOverflow="extendDomain"
            />
          )}
          <Tooltip
            content={<LabTrendTooltip range={range} unitName={unitName} />}
            cursor={{ stroke: '#C9A227', strokeWidth: 1, strokeDasharray: '2 2' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#E4E4E7"
            strokeWidth={2}
            dot={((dotProps: Record<string, unknown>) => (
              <LabStatusDot
                key={`dot-${dotProps.index}`}
                {...dotProps}
              />
            )) as never}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {range && (
        <div className="mt-1 flex items-center justify-between px-2 text-[11px] text-zinc-500">
          <span>
            Reference:{' '}
            <span className="text-zinc-400">
              {range.low}{'\u2013'}{range.high} {unitName}
            </span>
          </span>
          <span className="italic">{range.sourceLabel}</span>
        </div>
      )}
    </div>
  );
};
