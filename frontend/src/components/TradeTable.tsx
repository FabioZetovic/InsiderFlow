import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { chamberLabel, type HotTicker, type Trade } from '../types';
import { EmptyState, PartyBadge, SectorChip, TradeFlags, TypeBadge } from './ui';

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
}

interface TradeTableProps {
  trades: Trade[];
  /** Hide the member column on member detail pages. */
  hideMember?: boolean;
  /** Hot tickers (bought/sold >5x in the last 90 days) — bought ones render blue, sold ones grey. */
  hotTickers?: HotTicker[];
  /** Current sort in "field,dir" form; enables clickable headers when onSortChange is set. */
  sort?: string;
  onSortChange?: (sort: string) => void;
  /** Dim the table while a page change is in flight (rows stay visible). */
  refreshing?: boolean;
}

function TickerCell({ trade, hot, onOpen }: { trade: Trade; hot?: HotTicker; onOpen: (t: string) => void }) {
  if (!trade.ticker) {
    return (
      <div className="max-w-56">
        <span className="block truncate text-sm text-ink-400" title={trade.assetDescription ?? ''}>
          {trade.assetDescription ?? '—'}
        </span>
      </div>
    );
  }
  const hotClass = hot
    ? hot.highlight === 'BUY'
      ? 'bg-accent-500/15 text-accent-300'
      : 'bg-ink-500/25 text-ink-200'
    : 'text-ink-100 hover:text-brand-400';
  return (
    <div className="max-w-56">
      <button
        onClick={() => onOpen(trade.ticker!)}
        className={`inline-flex px-1.5 py-0.5 font-mono text-sm font-semibold transition-colors ${hotClass}`}
        title={
          hot
            ? `${trade.ticker}: bought ${hot.buyCount}× / sold ${hot.sellCount}× in the last 90 days — click for detail`
            : `${trade.ticker} — click for detail`
        }
      >
        {trade.ticker}
      </button>
      {trade.assetDescription && (
        <span className="mt-0.5 block truncate text-xs text-ink-500" title={trade.assetDescription}>
          {trade.assetDescription}
        </span>
      )}
    </div>
  );
}

function SuspiciousFlag({ trade }: { trade: Trade }) {
  if (!trade.suspiciousDate) {
    return null;
  }
  return (
    <span className="ml-1.5 bg-accent-500/15 px-1 text-[10px] font-semibold text-accent-300" title="Implausible date in the source filing">
      CHECK
    </span>
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

  if (trades.length === 0 && !refreshing) {
    return <EmptyState message="No trades match the current filters." />;
  }

  const [sortField, sortDir] = (sort ?? 'transactionDate,desc').split(',');

  const headers: HeaderDef[] = [
    ...(hideMember ? [] : [{ label: 'Member', field: 'member' } satisfies HeaderDef]),
    { label: 'Asset', field: 'ticker' },
    { label: 'Type', field: 'transactionType' },
    { label: 'Amount', field: 'amountMid' },
    { label: 'Date', field: 'transactionDate' },
    { label: 'Sector', field: 'sector' },
    { label: 'Filing', className: 'text-right' },
  ];

  const headerCell = (h: HeaderDef) => {
    const active = h.field && h.field === sortField;
    const sortable = h.field && onSortChange;
    const toggle = () => {
      if (!sortable) return;
      const nextDir = active && sortDir === 'desc' ? 'asc' : 'desc';
      onSortChange!(`${h.field},${nextDir}`);
    };
    return (
      <th key={h.label} className={`px-4 pt-4 pb-3 font-medium ${h.className ?? ''}`}>
        {sortable ? (
          <button
            onClick={toggle}
            className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink-300 ${
              active ? 'text-brand-400' : ''
            }`}
          >
            {h.label}
            {active && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
          </button>
        ) : (
          h.label
        )}
      </th>
    );
  };

  return (
    <div className={`transition-opacity duration-300 ${refreshing ? "pointer-events-none opacity-50" : ""}`}>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="rows-in w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-ink-500">{headers.map(headerCell)}</tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr
                key={trade.id}
                className="transition-colors even:bg-ink-950/30 hover:bg-brand-500/[0.06]"
              >
                {!hideMember && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate(`/insiders/member/${encodeURIComponent(trade.member)}`)}
                        className="font-medium text-ink-200 transition-colors hover:text-brand-400 text-left"
                      >
                        {trade.member}
                      </button>
                      <PartyBadge party={trade.party} />
                    </div>
                    <span className="block text-xs text-ink-500">
                      {chamberLabel(trade.chamber)}
                      {trade.state ? ` · ${trade.state}` : ''}
                    </span>
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <TickerCell trade={trade} hot={trade.ticker ? hotByTicker.get(trade.ticker) : undefined} onOpen={openTicker} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <TypeBadge type={trade.transactionType} />
                  </div>
                  <div className="mt-1">
                    <TradeFlags
                      lateDisclosure={trade.lateDisclosure}
                      committeeConflict={trade.committeeConflict}
                      nearEarnings={trade.nearEarnings}
                      lagDays={trade.disclosureLagDays}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-ink-300">{trade.amountRange ?? '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="block text-ink-300">
                    {formatDate(trade.transactionDate)}
                    <SuspiciousFlag trade={trade} />
                  </span>
                  {trade.disclosureDate && (
                    <span className="block text-xs text-ink-500">filed {formatDate(trade.disclosureDate)}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <SectorChip
                    sector={trade.sector}
                    onClick={() => navigate(`/insiders/sector/${encodeURIComponent(trade.sector)}`)}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {trade.ptrLink ? (
                    <a
                      href={trade.ptrLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-ink-500 transition-colors hover:text-brand-400"
                      title="Official filing"
                    >
                      Filing
                    </a>
                  ) : (
                    <span className="text-ink-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="rows-in md:hidden">
        {trades.map((trade) => (
          <li key={trade.id} className="space-y-1.5 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <TickerCell trade={trade} hot={trade.ticker ? hotByTicker.get(trade.ticker) : undefined} onOpen={openTicker} />
              <TypeBadge type={trade.transactionType} />
            </div>
            {!hideMember && (
              <button
                onClick={() => navigate(`/insiders/member/${encodeURIComponent(trade.member)}`)}
                className="flex items-center gap-1.5 text-sm text-ink-300"
              >
                {trade.member}
                <PartyBadge party={trade.party} />
                <span className="text-xs text-ink-500">
                  {chamberLabel(trade.chamber)}
                  {trade.state ? ` · ${trade.state}` : ''}
                </span>
              </button>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              <span className="text-ink-300">{trade.amountRange ?? '—'}</span>
              <span>
                {formatDate(trade.transactionDate)}
                <SuspiciousFlag trade={trade} />
              </span>
              <SectorChip
                sector={trade.sector}
                onClick={() => navigate(`/insiders/sector/${encodeURIComponent(trade.sector)}`)}
              />
              <TradeFlags
                lateDisclosure={trade.lateDisclosure}
                committeeConflict={trade.committeeConflict}
                nearEarnings={trade.nearEarnings}
                lagDays={trade.disclosureLagDays}
              />
              {trade.ptrLink && (
                <a href={trade.ptrLink} target="_blank" rel="noreferrer" className="text-ink-500 hover:text-brand-400">
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
