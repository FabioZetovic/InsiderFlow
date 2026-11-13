import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { chamberLabel, type HotTicker, type Trade } from '../types';
import { Avatar, EmptyState, PartyBadge, TradeFlags, TypeBadge } from './ui';

function formatDate(value: string | null, pattern = 'MMM d, yyyy'): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

interface TradeTableProps {
  trades: Trade[];
  /** Hide the member column on member detail pages. */
  hideMember?: boolean;
  /** Hot tickers (bought/sold >5x in the last 90 days) get an amber or grey ticker pill. */
  hotTickers?: HotTicker[];
  /** Current sort in "field,dir" form; enables clickable headers when onSortChange is set. */
  sort?: string;
  onSortChange?: (sort: string) => void;
  /** Dim the table while a page change is in flight (rows stay visible). */
  refreshing?: boolean;
}

const SIDE_STRIPE: Record<string, string> = {
  BUY: 'bg-up-500',
  SELL: 'bg-down-500',
  EXCHANGE: 'bg-secondary-500',
};

/** 1-5 bars for the disclosed amount band. */
function SizeMeter({ mid }: { mid: number | null }) {
  const level = mid == null ? 0 : mid <= 15_000 ? 1 : mid <= 50_000 ? 2 : mid <= 250_000 ? 3 : mid <= 1_000_000 ? 4 : 5;
  return (
    <span className="mt-1.5 flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`w-1.5 ${i <= level ? 'bg-brand-400' : 'bg-ink-700/70'}`} style={{ height: 3 + i * 2 }} />
      ))}
    </span>
  );
}

function TickerPill({ trade, hot, onOpen }: { trade: Trade; hot?: HotTicker; onOpen: (t: string) => void }) {
  if (!trade.ticker) {
    return (
      <span className="block max-w-60 truncate text-sm text-ink-300" title={trade.assetDescription ?? ''}>
        {trade.assetDescription ?? '—'}
      </span>
    );
  }
  const tone = hot
    ? hot.highlight === 'BUY'
      ? 'bg-accent-500/15 text-accent-300 hover:bg-accent-500/25'
      : 'bg-ink-600/40 text-ink-100 hover:bg-ink-600/60'
    : 'bg-ink-800/80 text-ink-50 hover:bg-brand-500/20 hover:text-brand-200';
  return (
    <div className="min-w-0 max-w-64">
      <button
        onClick={() => onOpen(trade.ticker!)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[13px] font-semibold transition-colors ${tone}`}
        title={
          hot
            ? `${trade.ticker}: bought ${hot.buyCount} / sold ${hot.sellCount} times in the last 90 days`
            : `Open ${trade.ticker}`
        }
      >
        {trade.ticker}
        {hot && <span className="font-sans text-[9px] font-bold tracking-wider opacity-80">HOT</span>}
      </button>
      {trade.assetDescription && (
        <span className="mt-1 block truncate text-xs text-ink-500" title={trade.assetDescription}>
          {trade.assetDescription}
        </span>
      )}
    </div>
  );
}

function FiledLag({ trade }: { trade: Trade }) {
  if (!trade.disclosureDate) return null;
  const lag = trade.disclosureLagDays;
  return (
    <span className={`mt-1 block text-[11px] ${trade.lateDisclosure ? 'text-accent-300' : 'text-ink-500'}`}>
      {lag != null ? `filed ${lag} day${lag === 1 ? '' : 's'} later` : `filed ${formatDate(trade.disclosureDate)}`}
      {trade.suspiciousDate && (
        <span className="ml-1.5 bg-accent-500/15 px-1 text-[10px] font-semibold text-accent-300" title="Implausible date in the source filing">
          CHECK DATE
        </span>
      )}
    </span>
  );
}

function SortArrow({ dir }: { dir: string }) {
  return (
    <svg viewBox="0 0 10 10" className={`h-2.5 w-2.5 transition-transform duration-200 ${dir === 'asc' ? 'rotate-180' : ''}`} fill="currentColor">
      <path d="M5 8L1.5 3h7z" />
    </svg>
  );
}

interface HeaderDef {
  label: string;
  field?: string; // sortable when set
  className?: string;
}

export function TradeTable({
  trades,
  hideMember = false,
  hotTickers = [],
  sort,
  onSortChange,
  refreshing = false,
}: TradeTableProps) {
  const navigate = useNavigate();
  const hotByTicker = new Map(hotTickers.map((h) => [h.ticker, h]));
  const openTicker = (ticker: string) => navigate(`/insiders/ticker/${encodeURIComponent(ticker)}`);
  const openMember = (member: string) => navigate(`/insiders/member/${encodeURIComponent(member)}`);

  if (trades.length === 0 && !refreshing) {
    return <EmptyState message="No trades match the current filters." />;
  }

  const [sortField, sortDir] = (sort ?? 'transactionDate,desc').split(',');
  const groupByDay = sortField === 'transactionDate';

  const headers: HeaderDef[] = [
    ...(hideMember ? [] : [{ label: 'Member', field: 'member' } satisfies HeaderDef]),
    { label: 'Asset', field: 'ticker' },
    { label: 'Side', field: 'transactionType' },
    { label: 'Amount', field: 'amountMid' },
    { label: 'Traded', field: 'transactionDate' },
    { label: 'Sector', field: 'sector' },
    { label: '', className: 'text-right' },
  ];

  const headerCell = (h: HeaderDef, i: number) => {
    const active = h.field && h.field === sortField;
    const sortable = h.field && onSortChange;
    const toggle = () => {
      if (!sortable) return;
      const nextDir = active && sortDir === 'desc' ? 'asc' : 'desc';
      onSortChange!(`${h.field},${nextDir}`);
    };
    return (
      <th key={h.label || i} className={`px-4 pt-5 pb-3 text-[10px] font-semibold uppercase tracking-[0.14em] ${i === 0 ? 'pl-6' : ''} ${h.className ?? ''}`}>
        {sortable ? (
          <button
            onClick={toggle}
            className={`inline-flex items-center gap-1.5 uppercase transition-colors hover:text-ink-200 ${active ? 'text-brand-300' : ''}`}
          >
            {h.label}
            {active && <SortArrow dir={sortDir} />}
          </button>
        ) : (
          h.label
        )}
      </th>
    );
  };

  // Day-group boundaries (only meaningful when the list is ordered by trade date).
  const dayCounts = new Map<string, number>();
  if (groupByDay) for (const t of trades) dayCounts.set(t.transactionDate, (dayCounts.get(t.transactionDate) ?? 0) + 1);

  return (
    <div className={`transition-opacity duration-300 ${refreshing ? 'pointer-events-none opacity-50' : ''}`}>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="rows-in w-full text-sm">
          <thead>
            <tr className="text-left text-ink-500">{headers.map(headerCell)}</tr>
          </thead>
          <tbody>
            {trades.map((trade, idx) => {
              const newDay = groupByDay && (idx === 0 || trades[idx - 1].transactionDate !== trade.transactionDate);
              return (
                <Fragment key={trade.id}>
                  {newDay && (
                    <tr>
                      <td colSpan={headers.length} className="px-6 pt-5 pb-2">
                        <span className="flex items-center gap-3 text-xs">
                          <span className="font-semibold text-ink-200">{formatDate(trade.transactionDate, 'EEEE, MMM d, yyyy')}</span>
                          <span className="text-ink-500">
                            {dayCounts.get(trade.transactionDate)} {dayCounts.get(trade.transactionDate) === 1 ? 'trade' : 'trades'}
                          </span>
                          <span className="h-px flex-1 bg-ink-800" />
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr className="group transition-colors hover:bg-brand-500/[0.06]">
                    {!hideMember && (
                      <td className="relative py-3 pr-4 pl-6">
                        <span className={`absolute inset-y-2 left-0 w-[3px] ${SIDE_STRIPE[trade.transactionType] ?? 'bg-ink-600'}`} />
                        <button onClick={() => openMember(trade.member)} className="flex items-center gap-3 text-left">
                          <Avatar name={trade.member} party={trade.party} size="sm" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="font-medium text-ink-100 transition-colors group-hover:text-ink-50 hover:text-brand-300">
                                {trade.member}
                              </span>
                              <PartyBadge party={trade.party} />
                            </span>
                            <span className="block text-[11px] text-ink-500">
                              {chamberLabel(trade.chamber)}
                              {trade.state ? ` · ${trade.state}` : ''}
                            </span>
                          </span>
                        </button>
                      </td>
                    )}
                    <td className={`relative py-3 pr-4 ${hideMember ? 'pl-6' : 'pl-4'}`}>
                      {hideMember && <span className={`absolute inset-y-2 left-0 w-[3px] ${SIDE_STRIPE[trade.transactionType] ?? 'bg-ink-600'}`} />}
                      <TickerPill trade={trade} hot={trade.ticker ? hotByTicker.get(trade.ticker) : undefined} onOpen={openTicker} />
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={trade.transactionType} />
                      <div className="mt-1.5">
                        <TradeFlags
                          lateDisclosure={trade.lateDisclosure}
                          committeeConflict={trade.committeeConflict}
                          nearEarnings={trade.nearEarnings}
                          lagDays={trade.disclosureLagDays}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-ink-100">{trade.amountRange ?? '—'}</span>
                      <SizeMeter mid={trade.amountMid} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-ink-200">{formatDate(trade.transactionDate)}</span>
                      <FiledLag trade={trade} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/insiders/sector/${encodeURIComponent(trade.sector)}`)}
                        className="max-w-44 truncate text-left text-xs text-ink-400 transition-colors hover:text-brand-300"
                        title={trade.sector}
                      >
                        {trade.sector}
                      </button>
                    </td>
                    <td className="px-4 py-3 pr-6 text-right">
                      {trade.ptrLink ? (
                        <a
                          href={trade.ptrLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block px-2.5 py-1 text-xs font-medium text-ink-500 opacity-60 transition hover:bg-ink-800 hover:text-brand-300 group-hover:opacity-100"
                          title="Official filing"
                        >
                          Filing
                        </a>
                      ) : (
                        <span className="text-ink-700">—</span>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="rows-in space-y-px md:hidden">
        {trades.map((trade) => (
          <li key={trade.id} className="relative space-y-2 bg-ink-950/20 py-3 pr-4 pl-5">
            <span className={`absolute inset-y-0 left-0 w-[3px] ${SIDE_STRIPE[trade.transactionType] ?? 'bg-ink-600'}`} />
            <div className="flex items-start justify-between gap-3">
              <TickerPill trade={trade} hot={trade.ticker ? hotByTicker.get(trade.ticker) : undefined} onOpen={openTicker} />
              <TypeBadge type={trade.transactionType} />
            </div>
            {!hideMember && (
              <button onClick={() => openMember(trade.member)} className="flex items-center gap-2 text-sm text-ink-200">
                <Avatar name={trade.member} party={trade.party} size="sm" />
                {trade.member}
                <PartyBadge party={trade.party} />
              </button>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
              <span className="font-medium text-ink-200">{trade.amountRange ?? '—'}</span>
              <span>{formatDate(trade.transactionDate)}</span>
              <span>{trade.sector}</span>
              <TradeFlags
                lateDisclosure={trade.lateDisclosure}
                committeeConflict={trade.committeeConflict}
                nearEarnings={trade.nearEarnings}
                lagDays={trade.disclosureLagDays}
              />
              {trade.ptrLink && (
                <a href={trade.ptrLink} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-brand-300">
                  Filing
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
