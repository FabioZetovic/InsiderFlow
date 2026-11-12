import { AlertTriangle, CalendarClock, Clock, Landmark } from 'lucide-react';
import { partyInitial, type Party, type TransactionType } from '../types';

/** Compact USD formatter: 1234567 -> "$1.2M", 4500 -> "$4.5K". */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || value === 0) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/** Small icon badges for the accountability/context flags on a trade. */
export function TradeFlags({
  lateDisclosure,
  committeeConflict,
  nearEarnings,
  lagDays,
}: {
  lateDisclosure?: boolean;
  committeeConflict?: string | null;
  nearEarnings?: boolean;
  lagDays?: number | null;
}) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {lateDisclosure && (
        <span
          className="inline-flex items-center rounded bg-accent-500/15 px-1 py-0.5 text-[10px] font-semibold text-accent-400 ring-1 ring-accent-500/30"
          title={`Disclosed late${lagDays ? ` (${lagDays} days after the trade; STOCK Act allows 45)` : ''}`}
        >
          <Clock className="mr-0.5 h-2.5 w-2.5" />
          LATE
        </span>
      )}
      {committeeConflict && (
        <span
          className="inline-flex items-center rounded bg-brand-500/15 px-1 py-0.5 text-[10px] font-semibold text-brand-300 ring-1 ring-brand-500/30"
          title={`Potential conflict — member sits on ${committeeConflict}, which oversees this sector`}
        >
          <Landmark className="mr-0.5 h-2.5 w-2.5" />
          COMMITTEE
        </span>
      )}
      {nearEarnings && (
        <span
          className="inline-flex items-center rounded bg-secondary-500/15 px-1 py-0.5 text-[10px] font-semibold text-secondary-400 ring-1 ring-secondary-500/30"
          title="Traded within ~2 weeks before the company's earnings report"
        >
          <CalendarClock className="mr-0.5 h-2.5 w-2.5" />
          EARNINGS
        </span>
      )}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ink-800/80 ${className}`} />;
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <AlertTriangle className="w-8 h-8 text-accent-500" />
      <p className="text-sm text-ink-400 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-sm rounded-md bg-ink-800 hover:bg-ink-700 text-ink-200 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="py-12 text-center text-sm text-ink-500">{message}</div>;
}

export function TypeBadge({ type }: { type: TransactionType }) {
  const styles: Record<TransactionType, string> = {
    BUY: 'bg-up-500/15 text-up-400 ring-up-500/30',
    SELL: 'bg-down-500/15 text-down-400 ring-down-500/30',
    EXCHANGE: 'bg-secondary-500/15 text-secondary-400 ring-secondary-500/30',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ring-1 ${styles[type]}`}>
      {type}
    </span>
  );
}

export function PartyBadge({ party }: { party: Party | null | undefined }) {
  const initial = partyInitial(party);
  if (!initial) {
    return null;
  }
  const styles: Record<string, string> = {
    D: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
    R: 'bg-down-500/15 text-down-400 ring-down-500/30',
    I: 'bg-ink-500/20 text-ink-200 ring-ink-400/30',
  };
  return (
    <span
      className={`inline-flex h-4.5 min-w-4.5 items-center justify-center rounded px-1 text-[10px] font-bold ring-1 ${styles[initial]}`}
      title={party ?? undefined}
    >
      {initial}
    </span>
  );
}

export function SectorChip({ sector, onClick }: { sector: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex px-2 py-0.5 rounded-full text-xs bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-100 transition-colors max-w-44 truncate"
      title={sector}
    >
      {sector}
    </button>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-ink-800 bg-ink-900/70 shadow-sm shadow-black/20 ${className}`}>
      {title && (
        <h2 className="px-4 py-3 border-b border-ink-800 text-xs font-semibold text-ink-400 uppercase tracking-[0.08em]">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
