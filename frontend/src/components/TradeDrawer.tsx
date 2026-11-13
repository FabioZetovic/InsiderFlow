import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getTradePosition } from '../api';
import { chamberLabel, type TradePosition } from '../types';
import { Avatar, PartyBadge, Skeleton, TradeFlags, TypeBadge } from './ui';

const PARAM = 'trade';

/** Open a trade in the detail panel (kept in the URL, so Back closes it and links can be shared). */
export function useOpenTrade() {
  const [, setSearchParams] = useSearchParams();
  return useCallback(
    (id: string) =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set(PARAM, id);
        return next;
      }),
    [setSearchParams],
  );
}

function money(n: number | null | undefined): string {
  return n == null ? '—' : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function dateLabel(d: string | null | undefined, pattern = 'MMM d, yyyy'): string {
  if (!d) return '—';
  try {
    return format(parseISO(d), pattern);
  } catch {
    return d;
  }
}

function Metric({
  label,
  value,
  sub,
  tone = 'text-ink-50',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="bg-ink-900/70 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

interface ChartRow {
  date: string;
  close: number;
  buy?: number;
  sell?: number;
  label?: string;
}

/** Snap each of the member's trades onto the nearest price-series date at or before it. */
function buildChart(p: TradePosition): { rows: ChartRow[]; current?: ChartRow } {
  const rows: ChartRow[] = p.priceHistory.map((pt) => ({ date: pt.date, close: pt.close }));
  if (rows.length === 0) return { rows };
  const dates = rows.map((r) => r.date);
  const indexFor = (d: string) => {
    let lo = 0;
    let hi = dates.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (dates[mid] <= d) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  };
  let current: ChartRow | undefined;
  for (const t of p.memberTrades) {
    if (!t.transactionDate) continue;
    const i = indexFor(t.transactionDate);
    if (i < 0) continue;
    const row = rows[i];
    if (t.transactionType === 'BUY') row.buy = row.close;
    else if (t.transactionType === 'SELL') row.sell = row.close;
    row.label = `${t.transactionType} ${t.amountRange ?? ''}`.trim();
    if (t.id === p.trade.id) current = row;
  }
  return { rows, current };
}

function ChartTip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartRow }> }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-ink-800 px-3 py-2 text-xs shadow-2xl shadow-black/50">
      <div className="text-ink-400">{dateLabel(r.date)}</div>
      <div className="mt-0.5 font-semibold text-ink-50">{money(r.close)}</div>
      {r.label && <div className={r.buy != null ? 'text-up-400' : 'text-down-400'}>{r.label}</div>}
    </div>
  );
}

function PositionView({ p, onPick }: { p: TradePosition; onPick: (id: string) => void }) {
  const t = p.trade;
  const isBuy = t.transactionType === 'BUY';
  const { rows, current } = useMemo(() => buildChart(p), [p]);
  const up = rows.length > 1 && rows[rows.length - 1].close >= rows[0].close;

  return (
    <div className="stagger space-y-6">
      {/* Who + what */}
      <div className="flex items-start gap-4">
        <Avatar name={t.member} party={t.party} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/insiders/member/${encodeURIComponent(t.member)}`} className="text-xl font-bold text-ink-50 hover:text-brand-300">
              {t.member}
            </Link>
            <PartyBadge party={t.party} />
          </div>
          <div className="text-xs text-ink-500">
            {chamberLabel(t.chamber)}
            {t.state ? ` · ${t.state}` : ''}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TypeBadge type={t.transactionType} />
            {p.ticker ? (
              <Link
                to={`/insiders/ticker/${encodeURIComponent(p.ticker)}`}
                className="bg-ink-800/80 px-2 py-0.5 font-mono text-sm font-semibold text-ink-50 hover:bg-brand-500/20 hover:text-brand-200"
              >
                {p.ticker}
              </Link>
            ) : null}
            <span className="text-sm text-ink-300">{t.amountRange ?? ''}</span>
            <TradeFlags
              lateDisclosure={t.lateDisclosure}
              committeeConflict={t.committeeConflict}
              nearEarnings={t.nearEarnings}
              lagDays={t.disclosureLagDays}
            />
          </div>
          {t.assetDescription && <div className="mt-1.5 text-xs text-ink-500">{t.assetDescription}</div>}
        </div>
      </div>

      {/* Dates */}
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-ink-500">Traded </span>
          <span className="font-medium text-ink-100">{dateLabel(t.transactionDate)}</span>
        </div>
        {t.disclosureDate && (
          <div>
            <span className="text-ink-500">Disclosed </span>
            <span className="font-medium text-ink-100">{dateLabel(t.disclosureDate)}</span>
            {t.disclosureLagDays != null && (
              <span className={t.lateDisclosure ? 'text-accent-300' : 'text-ink-500'}> ({t.disclosureLagDays} days later)</span>
            )}
          </div>
        )}
        {t.ptrLink && (
          <a href={t.ptrLink} target="_blank" rel="noreferrer" className="font-medium text-brand-300 hover:text-brand-200">
            Official filing
          </a>
        )}
      </div>

      {p.ticker == null ? (
        <p className="bg-ink-900/70 px-5 py-6 text-sm text-ink-400">
          This asset has no exchange ticker (for example a bond, private fund or option without a symbol), so there are no
          market prices to chart.
        </p>
      ) : rows.length === 0 ? (
        <p className="bg-ink-900/70 px-5 py-6 text-sm text-ink-400">No price history is available for {p.ticker}.</p>
      ) : (
        <>
          {/* Price figures */}
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
            <Metric
              label={isBuy ? 'Entry price' : t.transactionType === 'SELL' ? 'Exit price' : 'Price that day'}
              value={money(p.entryPrice)}
              sub={`close on ${dateLabel(t.transactionDate, 'MMM d')}`}
            />
            <Metric
              label="Avg buy price"
              value={money(p.avgBuyPrice)}
              sub={p.pricedBuys > 0 ? `across ${p.pricedBuys} buy${p.pricedBuys === 1 ? '' : 's'}` : 'no priced buys'}
              tone="text-brand-300"
            />
            <Metric label="Latest close" value={money(p.latestPrice)} sub={dateLabel(p.latestDate, 'MMM d')} />
            <Metric
              label={isBuy ? 'Since this buy' : 'Since this trade'}
              value={pct(p.changeSinceTradePercent)}
              sub={p.avgBuyReturnPercent != null ? `${pct(p.avgBuyReturnPercent)} vs avg buy` : undefined}
              tone={
                p.changeSinceTradePercent == null
                  ? 'text-ink-50'
                  : p.changeSinceTradePercent >= 0
                    ? 'text-up-400'
                    : 'text-down-400'
              }
            />
          </div>

          {/* Chart */}
          <div className="bg-ink-900/70 pt-4 pr-2 pb-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 text-[11px] text-ink-500">
              <span className="font-semibold uppercase tracking-[0.14em] text-ink-400">{p.ticker} price</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-up-500" />their buys</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-down-500" />their sells</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-accent-400" />this trade</span>
              {p.avgBuyPrice != null && (
                <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-brand-400" />avg buy</span>
              )}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232a3f" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#6b7592', fontSize: 11 }}
                    stroke="#343c55"
                    minTickGap={50}
                    tickFormatter={(d: string) => dateLabel(d, 'MMM yy')}
                  />
                  <YAxis
                    tick={{ fill: '#6b7592', fontSize: 11 }}
                    stroke="#343c55"
                    domain={['auto', 'auto']}
                    tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                    width={56}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: '#535d7a', strokeDasharray: '4 4' }} />
                  {p.avgBuyPrice != null && (
                    <ReferenceLine
                      y={p.avgBuyPrice}
                      stroke="#9294ff"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{ value: `avg buy ${money(p.avgBuyPrice)}`, position: 'insideTopLeft', fill: '#b1b4ff', fontSize: 11 }}
                    />
                  )}
                  <Line type="monotone" dataKey="close" stroke={up ? '#22b673' : '#e5484d'} strokeWidth={2} dot={false} animationDuration={1000} />
                  <Scatter dataKey="buy" fill="#22b673" stroke="#0c111d" strokeWidth={2} r={5} animationBegin={800} />
                  <Scatter dataKey="sell" fill="#e5484d" stroke="#0c111d" strokeWidth={2} r={5} animationBegin={800} />
                  {current && (
                    <ReferenceDot x={current.date} y={current.close} r={9} fill="none" stroke="#f6bd4f" strokeWidth={2.5} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Their full history in this ticker */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-400">
                All their {p.ticker} trades
              </h3>
              <span className="text-[11px] text-ink-500">
                {p.buyCount} buys · {p.sellCount} sells
              </span>
            </div>
            <ul className="rows-in max-h-72 space-y-px overflow-y-auto">
              {p.memberTrades
                .slice()
                .reverse()
                .map((mt) => {
                  const here = mt.id === t.id;
                  return (
                    <li key={mt.id}>
                      <button
                        onClick={() => onPick(mt.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                          here ? 'bg-accent-500/10' : 'bg-ink-900/60 hover:bg-ink-800/80'
                        }`}
                      >
                        <span className={`h-6 w-[3px] ${mt.transactionType === 'BUY' ? 'bg-up-500' : mt.transactionType === 'SELL' ? 'bg-down-500' : 'bg-secondary-500'}`} />
                        <span className="w-24 shrink-0 text-ink-300">{dateLabel(mt.transactionDate, 'MMM d, yyyy')}</span>
                        <span className={`w-12 shrink-0 text-xs font-semibold ${mt.transactionType === 'BUY' ? 'text-up-400' : 'text-down-400'}`}>
                          {mt.transactionType}
                        </span>
                        <span className="flex-1 truncate text-xs text-ink-400">{mt.amountRange ?? ''}</span>
                        <span className="shrink-0 font-medium tabular-nums text-ink-100">{money(mt.price)}</span>
                        {here && <span className="shrink-0 text-[10px] font-bold text-accent-300">THIS</span>}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>

          <p className="text-[11px] leading-relaxed text-ink-500">
            Prices are daily closes on each trade date. Disclosures report dollar ranges rather than share counts, so the average
            buy price is an estimate: each buy's close weighted by the midpoint of its disclosed range. It ignores sells and
            any holdings bought before the disclosure data starts.
          </p>
        </>
      )}
    </div>
  );
}

/** Slide-in panel for the trade in `?trade=<id>`. Mounted once in the app layout. */
export function TradeDrawer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const id = searchParams.get(PARAM);
  const [data, setData] = useState<TradePosition | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const close = useCallback(
    () =>
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete(PARAM);
        return next;
      }),
    [setSearchParams],
  );

  const pick = useCallback(
    (next: string) =>
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set(PARAM, next);
          return p;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    getTradePosition(id)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [id, close]);

  if (!id) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Trade detail">
      <div className="animate-fade absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={close} />
      <aside className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-ink-950 shadow-2xl shadow-black">
        <div className="flex items-center justify-between bg-ink-900/80 px-6 py-4">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Trade detail</span>
          <button onClick={close} className="px-3 py-1.5 text-xs font-semibold text-ink-300 hover:bg-ink-800 hover:text-ink-50">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {error ? (
            <p className="py-12 text-center text-sm text-ink-400">Couldn't load this trade.</p>
          ) : loading && (!data || data.trade.id !== id) ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-2/3" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : data ? (
            <div key={data.trade.id} className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <PositionView p={data} onPick={pick} />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
