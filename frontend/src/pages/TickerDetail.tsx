import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getCorporateForTicker, getTickerDetail } from '../api';
import type { InsiderTrade, TickerDetail as TickerDetailData } from '../types';
import { TradeTable } from '../components/TradeTable';
import { WatchButton } from '../components/WatchButton';
import { Card, CountUp, ErrorState, formatMoney, PartyBadge, Skeleton } from '../components/ui';

interface ChartPoint {
  date: string;
  close: number;
  buy: number | null;
  sell: number | null;
  buyCount: number;
  sellCount: number;
}

function buildChartData(detail: TickerDetailData): ChartPoint[] {
  const buysByDate = new Map<string, number>();
  const sellsByDate = new Map<string, number>();
  for (const trade of detail.recentTrades) {
    if (trade.suspiciousDate) continue;
    const map = trade.transactionType === 'BUY' ? buysByDate : trade.transactionType === 'SELL' ? sellsByDate : null;
    if (map) map.set(trade.transactionDate, (map.get(trade.transactionDate) ?? 0) + 1);
  }
  return detail.priceHistory.map((p) => {
    const buyCount = buysByDate.get(p.date) ?? 0;
    const sellCount = sellsByDate.get(p.date) ?? 0;
    return {
      date: p.date,
      close: p.close,
      buy: buyCount > 0 ? p.close : null,
      sell: sellCount > 0 ? p.close : null,
      buyCount,
      sellCount,
    };
  });
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-ink-800 px-3 py-2 text-xs shadow-2xl shadow-black/50">
      <div className="text-ink-400">{point.date}</div>
      <div className="mt-0.5 font-semibold text-ink-100">${point.close.toFixed(2)}</div>
      {point.buyCount > 0 && <div className="text-up-400">{point.buyCount} congress buy{point.buyCount > 1 ? 's' : ''}</div>}
      {point.sellCount > 0 && <div className="text-down-400">{point.sellCount} congress sell{point.sellCount > 1 ? 's' : ''}</div>}
    </div>
  );
}

export function TickerDetail() {
  const { ticker = '' } = useParams();
  const [detail, setDetail] = useState<TickerDetailData | null>(null);
  const [corporate, setCorporate] = useState<InsiderTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCorporateForTicker(ticker)
      .then((c) => !cancelled && setCorporate(c))
      .catch(() => {});
    getTickerDetail(ticker)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError(`No congress trading data found for ${ticker.toUpperCase()}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => load(), [load]);

  const chartData = useMemo(() => (detail ? buildChartData(detail) : []), [detail]);
  const up = chartData.length > 1 && chartData[chartData.length - 1].close >= chartData[0].close;
  const lineColor = up ? '#22b673' : '#e5484d';

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/insiders" className="inline-block text-sm text-ink-400 transition-colors hover:text-brand-300">
          Back to all trades
        </Link>
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="stagger space-y-8">
      <Link to="/insiders" className="inline-block text-sm text-ink-400 transition-colors hover:text-brand-300">
        Back to all trades
      </Link>

      {loading && !detail ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-80" />
        </div>
      ) : detail ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-3 font-mono text-3xl font-bold tracking-tight text-ink-50">
                {detail.ticker}
                <WatchButton type="ticker" value={detail.ticker} />
              </h1>
              <p className="text-sm text-ink-500">
                {detail.companyName ?? ''}
                {detail.sector ? ` · ${detail.sector}` : ''}
              </p>
            </div>
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-bold text-ink-100"><CountUp value={detail.tradeCount} /></div>
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Congress trades</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-up-400"><CountUp value={detail.buyCount} /></div>
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Buys</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-down-400"><CountUp value={detail.sellCount} /></div>
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Sells</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card title="1 year price with congress buys and sells" className="xl:col-span-2">
              {chartData.length > 1 ? (
                <div className="h-80 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#232a3f" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: '#6b7592', fontSize: 11 }} stroke="#343c55" minTickGap={60} />
                      <YAxis
                        tick={{ fill: '#6b7592', fontSize: 11 }}
                        stroke="#343c55"
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                        width={60}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#535d7a', strokeDasharray: '4 4' }} />
                      <Line type="monotone" dataKey="close" stroke={lineColor} strokeWidth={2} dot={false} animationDuration={1200} />
                      {/* Trade markers: >=8px dots with a 2px surface ring so they read on top of the line */}
                      <Scatter dataKey="buy" fill="#22b673" stroke="#0c111d" strokeWidth={2} r={5} animationBegin={900} />
                      <Scatter dataKey="sell" fill="#e5484d" stroke="#0c111d" strokeWidth={2} r={5} animationBegin={900} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-ink-500">
                  No price history available for {detail.ticker}. Markers need Yahoo data for this symbol.
                </p>
              )}
            </Card>

            <Card title="Member activity">
              {detail.members.length > 0 ? (
                <ul className="rows-in max-h-80 overflow-y-auto pb-3">
                  {detail.members.map((m) => (
                    <li key={m.member} className="flex items-center gap-2 px-5 py-2 text-sm transition-colors hover:bg-brand-500/[0.06]">
                      <Link to={`/insiders/member/${encodeURIComponent(m.member)}`} className="truncate text-ink-200 hover:text-brand-400">
                        {m.member}
                      </Link>
                      <PartyBadge party={m.party} />
                      <span className="ml-auto shrink-0 text-xs">
                        <span className="text-up-400">{m.buyCount}B</span>
                        <span className="mx-1 text-ink-600">/</span>
                        <span className="text-down-400">{m.sellCount}S</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-sm text-ink-500">
                  No members of Congress have disclosed trades in {detail.ticker}.
                </p>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card title="Recent congress trades" className={corporate.length > 0 ? 'xl:col-span-2' : 'xl:col-span-3'}>
              <TradeTable trades={detail.recentTrades} />
            </Card>

            {corporate.length > 0 && (
              <Card title="Corporate insiders (SEC Form 4)">
                <ul className="rows-in pb-3">
                  {corporate.slice(0, 15).map((c) => (
                    <li key={c.id} className="flex items-start gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-brand-500/[0.06]">
                      <div className="min-w-0">
                        <span className="block truncate text-ink-200">{c.insiderName}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {c.insiderTitle ? `${c.insiderTitle} · ` : ''}
                          {format(parseISO(c.transactionDate), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="ml-auto shrink-0 text-right">
                        <span
                          className={`block text-xs font-semibold ${
                            c.transactionType === 'BUY'
                              ? 'text-up-400'
                              : c.transactionType === 'SELL'
                                ? 'text-down-400'
                                : 'text-ink-400'
                          }`}
                        >
                          {c.transactionType}
                        </span>
                        <span className="block text-xs text-ink-400">{formatMoney(c.value)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
