import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ExternalLink } from 'lucide-react';
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
        <span className="block truncate text-sm text-zinc-400" title={trade.assetDescription ?? ''}>
          {trade.assetDescription ?? '—'}
        </span>
      </div>
    );
  }
  const hotClass = hot
    ? hot.highlight === 'BUY'
      ? 'bg-blue-500/25 text-blue-300 ring-1 ring-blue-500/40'
      : 'bg-zinc-500/30 text-zinc-200 ring-1 ring-zinc-400/40'
    : 'text-zinc-100 hover:text-emerald-400';
  return (
    <div className="max-w-56">
      <button
        onClick={() => onOpen(trade.ticker!)}
        className={`inline-flex rounded px-1.5 py-0.5 font-mono text-sm font-semibold transition-colors ${hotClass}`}
        title={
          hot
            ? `${trade.ticker}: bought ${hot.buyCount}× / sold ${hot.sellCount}× in the last 90 days — click for detail`
            : `${trade.ticker} — click for detail`
        }
      >
        {trade.ticker}
      </button>
      {trade.assetDescription && (
        <span className="mt-0.5 block truncate text-xs text-zinc-500" title={trade.assetDescription}>
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
    <AlertTriangle
      className="ml-1 inline h-3.5 w-3.5 text-amber-500"
      aria-label="Implausible date"
    />
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
      <th key={h.label} className={`px-4 py-3 font-medium ${h.className ?? ''}`}>
        {sortable ? (
          <button
            onClick={toggle}
            className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-zinc-300 ${
              active ? 'text-emerald-400' : ''
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
    <div className={refreshing ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-900">
            <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">{headers.map(headerCell)}</tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr
                key={trade.id}
                className="border-t border-zinc-800/60 even:bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors"
              >
                {!hideMember && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate(`/insiders/member/${encodeURIComponent(trade.member)}`)}
                        className="font-medium text-zinc-200 transition-colors hover:text-emerald-400 text-left"
                      >
                        {trade.member}
                      </button>
                      <PartyBadge party={trade.party} />
                    </div>
                    <span className="block text-xs text-zinc-500">
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
                <td className="px-4 py-2.5 whitespace-nowrap text-zinc-300">{trade.amountRange ?? '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="block text-zinc-300">
                    {formatDate(trade.transactionDate)}
                    <SuspiciousFlag trade={trade} />
                  </span>
                  {trade.disclosureDate && (
                    <span className="block text-xs text-zinc-500">filed {formatDate(trade.disclosureDate)}</span>
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
                      className="inline-block text-zinc-500 transition-colors hover:text-emerald-400"
                      title="Official filing"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-zinc-800/60 md:hidden">
        {trades.map((trade) => (
          <li key={trade.id} className="space-y-1.5 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <TickerCell trade={trade} hot={trade.ticker ? hotByTicker.get(trade.ticker) : undefined} onOpen={openTicker} />
              <TypeBadge type={trade.transactionType} />
            </div>
            {!hideMember && (
              <button
                onClick={() => navigate(`/insiders/member/${encodeURIComponent(trade.member)}`)}
                className="flex items-center gap-1.5 text-sm text-zinc-300"
              >
                {trade.member}
                <PartyBadge party={trade.party} />
                <span className="text-xs text-zinc-500">
                  {chamberLabel(trade.chamber)}
                  {trade.state ? ` · ${trade.state}` : ''}
                </span>
              </button>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="text-zinc-300">{trade.amountRange ?? '—'}</span>
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
                <a href={trade.ptrLink} target="_blank" rel="noreferrer" className="text-zinc-500">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
