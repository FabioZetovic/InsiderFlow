import { format, parseISO } from 'date-fns';
import type { MarketEvent, MarketEventType } from '../types';
import { EmptyState } from './ui';

const TYPE_STYLES: Record<MarketEventType, string> = {
  FED: 'bg-brand-500/15 text-brand-300 ring-brand-500/30',
  CPI: 'bg-accent-500/15 text-accent-400 ring-accent-500/30',
  PPI: 'bg-accent-500/10 text-accent-300 ring-accent-500/25',
  JOBS: 'bg-secondary-500/15 text-secondary-400 ring-secondary-500/30',
  GDP: 'bg-secondary-500/10 text-secondary-300 ring-secondary-500/25',
};

export function EventsList({ events }: { events: MarketEvent[] }) {
  if (events.length === 0) {
    return <EmptyState message="No upcoming events in range." />;
  }
  return (
    <ul className="divide-y divide-ink-800/70">
      {events.map((event) => (
        <li key={`${event.date}-${event.title}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="w-24 shrink-0 text-ink-400 font-mono text-xs">
            {format(parseISO(event.date), 'EEE MMM d')}
          </span>
          <span
            className={`inline-flex w-12 justify-center px-1.5 py-0.5 rounded text-[11px] font-bold ring-1 ${
              TYPE_STYLES[event.type] ?? 'bg-ink-500/15 text-ink-400 ring-ink-500/30'
            }`}
          >
            {event.type}
          </span>
          <span className="text-ink-200">{event.title}</span>
        </li>
      ))}
    </ul>
  );
}
