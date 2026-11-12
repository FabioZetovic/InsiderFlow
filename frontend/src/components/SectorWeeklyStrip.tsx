import { useNavigate } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { SectorWeekly } from '../types';
import { Skeleton } from './ui';

/**
 * Horizontal strip above the congress trade table: how each GICS sector (via its SPDR ETF)
 * performed over the last trading week.
 */
/** ETF display names → GICS sector names used on trades (only XLK differs). */
function gicsName(etfName: string): string {
  return etfName === 'Technology' ? 'Information Technology' : etfName;
}

export function SectorWeeklyStrip({ sectors, loading }: { sectors: SectorWeekly[]; loading: boolean }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: 11 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-36 shrink-0" />
        ))}
      </div>
    );
  }

  if (sectors.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
        Sector performance — last trading week
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {sectors.map((s) => {
          const up = s.weeklyChangePercent >= 0;
          return (
            <button
              key={s.symbol}
              onClick={() => navigate(`/insiders/sector/${encodeURIComponent(gicsName(s.name))}`)}
              title={`${s.symbol}: $${s.weekAgoClose.toFixed(2)} → $${s.lastClose.toFixed(2)} (click for congress trades in ${s.name})`}
              className={`shrink-0 rounded-md border px-3 py-2 text-left transition-colors hover:brightness-125 ${
                up
                  ? 'border-up-500/30 bg-up-500/10'
                  : 'border-down-500/30 bg-down-500/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-ink-300">{s.symbol}</span>
                <span
                  className={`flex items-center gap-1 text-sm font-semibold ${
                    up ? 'text-up-400' : 'text-down-400'
                  }`}
                >
                  {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {up ? '+' : ''}
                  {s.weeklyChangePercent.toFixed(2)}%
                </span>
              </div>
              <div className="mt-0.5 max-w-36 truncate text-xs text-ink-400">{s.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
