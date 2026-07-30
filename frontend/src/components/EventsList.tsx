import { format, parseISO } from 'date-fns';
import type { MarketEvent, MarketEventType } from '../types';
import { EmptyState } from './ui';

const TYPE_STYLES: Record<MarketEventType, string> = {
  FED: 'bg-violet-500/15 text-violet-400 ring-violet-500/30',
  CPI: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  PPI: 'bg-orange-500/15 text-orange-400 ring-orange-500/30',
  JOBS: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  GDP: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
};

export function EventsList({ events }: { events: MarketEvent[] }) {
  if (events.length === 0) {
    return <EmptyState message="No upcoming events in range." />;
  }
  return (
    <ul className="divide-y divide-zinc-800/70">
      {events.map((event) => (
        <li key={`${event.date}-${event.title}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="w-24 shrink-0 text-zinc-400 font-mono text-xs">
            {format(parseISO(event.date), 'EEE MMM d')}
          </span>
          <span
            className={`inline-flex w-12 justify-center px-1.5 py-0.5 rounded text-[11px] font-bold ring-1 ${
              TYPE_STYLES[event.type] ?? 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30'
            }`}
          >
            {event.type}
          </span>
          <span className="text-zinc-200">{event.title}</span>
        </li>
      ))}
    </ul>
  );
}
