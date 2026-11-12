import { format, parseISO } from 'date-fns';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import type { SpxResponse } from '../types';

export function SpxStrip({ spx }: { spx: SpxResponse }) {
  const up = spx.change >= 0;
  const color = up ? '#22b673' : '#e5484d';
  const sparkData = spx.sparkline.map((value, i) => ({ i, value }));

  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-5 pb-5">
      <div>
        <div className="text-xs text-ink-500 uppercase tracking-wider">S&amp;P 500 (SPY)</div>
        <div className="text-2xl font-bold text-ink-100">${spx.price.toFixed(2)}</div>
      </div>
      <div className={`text-lg font-semibold ${up ? 'text-up-400' : 'text-down-400'}`}>
        {up ? '+' : ''}
        {spx.change.toFixed(2)} ({up ? '+' : ''}
        {spx.changePercent.toFixed(2)}%)
      </div>
      {sparkData.length > 1 && (
        <div className="h-14 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} animationDuration={1000} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="w-full text-xs text-ink-600">
        Updated {format(parseISO(spx.updatedAt), 'HH:mm:ss')}
      </div>
    </div>
  );
}
