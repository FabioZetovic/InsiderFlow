import { useEffect, useRef, useState } from 'react';
import { partyInitial, type Party, type TransactionType } from '../types';

/** Number that counts up from 0 (ease-out) when it first renders. */
export function CountUp({
  value,
  duration = 1200,
  format = (n: number) => Math.round(n).toLocaleString(),
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = origin + (value - origin) * eased;
      setShown(next);
      from.current = next;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/** Compact USD formatter: 1234567 -> "$1.2M", 4500 -> "$4.5K". */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || value === 0) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

const FLAG = 'inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold tracking-wide';

/** Small text badges for the accountability/context flags on a trade. */
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
          className={`${FLAG} bg-accent-500/15 text-accent-300`}
          title={`Disclosed late${lagDays ? ` (${lagDays} days after the trade; STOCK Act allows 45)` : ''}`}
        >
          LATE
        </span>
      )}
      {committeeConflict && (
        <span
          className={`${FLAG} bg-brand-500/15 text-brand-300`}
          title={`Potential conflict: member sits on ${committeeConflict}, which oversees this sector`}
        >
          COMMITTEE
        </span>
      )}
      {nearEarnings && (
        <span
          className={`${FLAG} bg-secondary-500/15 text-secondary-300`}
          title="Traded within ~2 weeks before the company's earnings report"
        >
          EARNINGS
        </span>
      )}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer ${className}`} />;
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
    <div className="animate-fade flex flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="text-sm text-ink-400 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-sm bg-ink-800 hover:bg-ink-700 text-ink-200"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="animate-fade py-12 text-center text-sm text-ink-500">{message}</div>;
}

export function TypeBadge({ type }: { type: TransactionType }) {
  const styles: Record<TransactionType, string> = {
    BUY: 'bg-up-500/15 text-up-400',
    SELL: 'bg-down-500/15 text-down-400',
    EXCHANGE: 'bg-secondary-500/15 text-secondary-400',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold ${styles[type]}`}>
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
    D: 'bg-blue-500/15 text-blue-400',
    R: 'bg-down-500/15 text-down-400',
    I: 'bg-ink-500/20 text-ink-200',
  };
  return (
    <span
      className={`inline-flex h-4.5 min-w-4.5 items-center justify-center px-1 text-[10px] font-bold ${styles[initial]}`}
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
      className="inline-flex px-2 py-0.5 text-xs text-ink-400 hover:text-brand-300 max-w-44 truncate"
      title={sector}
    >
      {sector}
    </button>
  );
}

/** Page title + optional description and right-hand slot. */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span aria-hidden className="mb-3 block h-1 w-10 bg-gradient-to-r from-brand-500 to-accent-400" />
        <h1 className="text-3xl font-bold tracking-tight text-ink-50">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm text-ink-400">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/** Small uppercase label used above sections. */
export function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink-400 ${className}`}>{children}</h2>
  );
}

/**
 * A flat section: one solid tone laid on the page background. No border, no corners.
 * `plain` drops the background entirely so content sits straight on the page.
 */
export function Card({
  title,
  children,
  className = '',
  plain = false,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  plain?: boolean;
}) {
  return (
    <section className={`min-w-0 ${plain ? "" : "bg-ink-900/60"} ${className}`}>
      {title && (
        <h2 className={`${plain ? 'pb-3' : 'px-5 pt-4 pb-2'} text-xs font-semibold uppercase tracking-[0.1em] text-ink-400`}>
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

const AVATAR_TINT: Record<string, string> = {
  D: 'bg-blue-500/20 text-blue-300',
  R: 'bg-down-500/20 text-down-300',
  I: 'bg-ink-600/40 text-ink-200',
};

function initialsOf(name: string): string {
  const parts = name.replace(/[^A-Za-z\s.-]/g, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Round initials badge, tinted by party (or brand when there is none). */
export function Avatar({
  name,
  party,
  size = 'md',
  tint,
}: {
  name: string;
  party?: Party | null;
  size?: 'sm' | 'md' | 'lg';
  tint?: string;
}) {
  const dims = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs';
  const color = tint ?? AVATAR_TINT[partyInitial(party) ?? ''] ?? 'bg-brand-500/20 text-brand-300';
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dims} ${color}`}>
      {initialsOf(name)}
    </span>
  );
}

/** Segmented control with a sliding active pill. `value === ''` selects the first ("All") option. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { label: string; value: T | '' }[];
  value: T | '';
  onChange: (value: T | '') => void;
  size?: 'sm' | 'md';
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const pad = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]';
  return (
    <div className="relative inline-grid bg-ink-950/70 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 bg-brand-600 shadow-md shadow-brand-900/40 transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value || 'all'}
          onClick={() => onChange(o.value)}
          className={`relative z-10 whitespace-nowrap font-medium transition-colors duration-300 ${pad} ${
            o.value === value ? 'text-white' : 'text-ink-400 hover:text-ink-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Text field with a leading search glyph and an inline clear action. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className = '',
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
  onEnter?: () => void;
}) {
  return (
    <label className={`group flex items-center gap-2.5 bg-ink-950/70 px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:bg-ink-950 focus-within:ring-brand-500/60 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-500 group-focus-within:text-brand-400" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M13 13l4 4" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none"
      />
      {value && (
        <button onClick={() => onChange('')} className="shrink-0 text-xs text-ink-500 hover:text-ink-200">
          Clear
        </button>
      )}
    </label>
  );
}

/** Small uppercase caption above a control. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{children}</span>;
}

/** Big number + caption used in page headers. */
export function Stat({ value, label, tone = 'text-ink-50' }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink-500">{label}</div>
    </div>
  );
}
