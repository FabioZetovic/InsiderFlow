import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { EarningsEvent } from '../types';
import { EmptyState } from './ui';

/** Mega-caps get highlighted in the weekly earnings list. */
const MEGA_CAPS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'BRK.A',
  'AVGO', 'LLY', 'JPM', 'V', 'MA', 'UNH', 'XOM', 'WMT', 'JNJ', 'PG', 'HD', 'COST',
  'ORCL', 'ABBV', 'BAC', 'CVX', 'KO', 'CRM', 'AMD', 'NFLX', 'PEP', 'ADBE', 'TMO',
]);

function HourBadge({ hour }: { hour: string | null }) {
  if (hour === 'bmo') {
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold bg-secondary-500/15 text-secondary-400 ring-1 ring-secondary-500/30">BMO</span>;
  }
  if (hour === 'amc') {
    return <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30">AMC</span>;
  }
  return <span className="text-xs text-ink-600">—</span>;
}

export function EarningsList({ earnings }: { earnings: EarningsEvent[] }) {
  if (earnings.length === 0) {
    return (
      <EmptyState message="No cached earnings for this week yet — set FINNHUB_API_KEY and restart the backend." />
    );
  }

  const byDay = new Map<string, EarningsEvent[]>();
  for (const entry of earnings) {
    const list = byDay.get(entry.date) ?? [];
    list.push(entry);
    byDay.set(entry.date, list);
  }
  const days = [...byDay.keys()].sort();

  return (
    <div className="divide-y divide-ink-800/70">
      {days.map((day) => {
        const list = (byDay.get(day) ?? []).slice().sort((a, b) => {
          const aMega = MEGA_CAPS.has(a.symbol) ? 0 : 1;
          const bMega = MEGA_CAPS.has(b.symbol) ? 0 : 1;
          return aMega - bMega || a.symbol.localeCompare(b.symbol);
        });
        return (
          <div key={day}>
            <div className="px-4 py-2 bg-ink-900 text-xs font-semibold text-ink-400 uppercase tracking-wider sticky top-0 z-10">
              {format(parseISO(day), 'EEEE, MMM d')}
              <span className="ml-2 text-ink-600 normal-case font-normal">{list.length} reports</span>
            </div>
            <ul className="divide-y divide-ink-800/40">
              {list.slice(0, 40).map((entry) => {
                const mega = MEGA_CAPS.has(entry.symbol);
                return (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <Link
                      to={`/insiders/ticker/${encodeURIComponent(entry.symbol)}`}
                      className={`font-mono font-semibold w-20 shrink-0 hover:text-brand-400 transition-colors ${
                        mega ? 'text-accent-400' : 'text-ink-200'
                      }`}
                      title={`View ${entry.symbol}`}
                    >
                      {entry.symbol}
                      {mega && <span className="ml-1 text-[10px] align-top">★</span>}
                    </Link>
                    <HourBadge hour={entry.hour} />
                    <span className="ml-auto text-ink-400 text-xs">
                      EPS est: {entry.epsEstimate != null ? `$${entry.epsEstimate.toFixed(2)}` : '—'}
                      {entry.epsActual != null && (
                        <span className={entry.epsActual >= (entry.epsEstimate ?? 0) ? 'text-up-400' : 'text-down-400'}>
                          {' '}· actual ${entry.epsActual.toFixed(2)}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
