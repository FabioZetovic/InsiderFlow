import type { SectorFlow } from '../types';

/** Green/red background whose intensity scales with the magnitude of the daily move. */
function heatColor(changePercent: number): string {
  const intensity = Math.min(Math.abs(changePercent) / 2.5, 1); // saturate at ±2.5%
  const alpha = 0.1 + intensity * 0.45;
  return changePercent >= 0
    ? `rgba(34, 182, 115, ${alpha.toFixed(2)})`
    : `rgba(229, 72, 77, ${alpha.toFixed(2)})`;
}

export function SectorHeatmap({ flows }: { flows: SectorFlow[] }) {
  return (
    <div className="stagger grid grid-cols-2 gap-2 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4">
      {flows.map((flow) => (
        <div
          key={flow.symbol}
          className="lift p-3"
          style={{ background: heatColor(flow.changePercent) }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm font-bold text-ink-100">{flow.symbol}</span>
            <span className={`text-sm font-semibold ${flow.changePercent >= 0 ? 'text-up-300' : 'text-down-300'}`}>
              {flow.changePercent >= 0 ? '+' : ''}
              {flow.changePercent.toFixed(2)}%
            </span>
          </div>
          <div className="mt-1 text-xs text-ink-300/90 truncate" title={flow.name}>
            {flow.name}
          </div>
          <div className="mt-1 text-xs text-ink-400">${flow.price.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
