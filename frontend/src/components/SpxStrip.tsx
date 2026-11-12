import { format, parseISO } from 'date-fns';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import type { SpxResponse } from '../types';

export function SpxStrip({ spx }: { spx: SpxResponse }) {
  const up = spx.change >= 0;
  const color = up ? '#22b673' : '#e5484d';
  const sparkData = spx.sparkline.map((value, i) => ({ i, value }));

  return (
    <div className="flex items-center gap-6 px-4 py-3">
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
        <div className="h-12 flex-1 min-w-32 max-w-md">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="ml-auto text-xs text-ink-600">
        Updated {format(parseISO(spx.updatedAt), 'HH:mm:ss')}
      </div>
    </div>
  );
}
