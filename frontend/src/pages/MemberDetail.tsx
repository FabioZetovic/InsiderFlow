import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getMemberSummary, getTrades } from '../api';
import type { MemberSummary, PagedResponse, Trade } from '../types';
import { TradeTable } from '../components/TradeTable';
import { Pagination } from '../components/Pagination';
import { Card, CountUp, ErrorState, PartyBadge, Skeleton, TableSkeleton } from "../components/ui";
import { WatchButton } from '../components/WatchButton';

const PIE_COLORS = [
  '#7472f8', '#22b5d2', '#f6bd4f', '#3fd38c', '#f4707a',
  '#b1b4ff', '#93e4f3', '#ffd78f', '#86e3b4', '#ffa3aa', '#6b7592',
];

export function MemberDetail() {
  const { member = '' } = useParams();
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [trades, setTrades] = useState<PagedResponse<Trade> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getMemberSummary(member), getTrades({ member, page, size: 25 })])
      .then(([s, t]) => {
        if (!cancelled) {
          setSummary(s);
          setTrades(t);
        }
      })
      .catch(() => {
        if (!cancelled) setError(`Failed to load data for ${member}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [member, page]);

  useEffect(() => load(), [load]);

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="stagger space-y-8">
      <Link to="/trades" className="inline-block text-sm text-ink-400 transition-colors hover:text-brand-300">
        Back to all trades
      </Link>

      {loading && !summary ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        </div>
      ) : summary ? (
        <>
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-ink-50">
                {summary.member}
                <PartyBadge party={summary.party} />
                <WatchButton type="member" value={summary.member} />
              </h1>
              <p className="text-sm text-ink-500">
                {summary.party ? `${summary.party} · ` : ''}
                {summary.chamber === 'HOUSE'
                  ? 'House of Representatives'
                  : summary.chamber === 'EXECUTIVE'
                    ? 'President of the United States (OGE 278-T filings)'
                    : 'Senate'}
                {summary.state ? ` · ${summary.state}` : ''}
              </p>
            </div>
            <div className="flex gap-8 text-sm">
              <div>
                <div className="text-2xl font-bold text-ink-100"><CountUp value={summary.tradeCount} /></div>
                <div className="text-xs text-ink-500 uppercase tracking-wider">Trades</div>
              </div>
              {summary.estimatedVolume > 0 && (
                <div>
                  <div className="text-2xl font-bold text-ink-100">
                    ${(summary.estimatedVolume / 1_000_000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-ink-500 uppercase tracking-wider">Est. volume</div>
                </div>
              )}
              <div>
                <div className="text-2xl font-bold text-up-400"><CountUp value={summary.buyCount} /></div>
                <div className="text-xs text-ink-500 uppercase tracking-wider">Buys</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-down-400"><CountUp value={summary.sellCount} /></div>
                <div className="text-xs text-ink-500 uppercase tracking-wider">Sells</div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {summary && (
          <aside className="stagger space-y-6">
            <Card title="Sector breakdown">
              <div className="h-64 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.sectorBreakdown}
                      dataKey="count"
                      nameKey="sector"
                      innerRadius={50}
                      outerRadius={82}
                      paddingAngle={2}
                      animationDuration={900}
                    >
                      {summary.sectorBreakdown.map((entry, i) => (
                        <Cell key={entry.sector} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#161c2d', border: 'none', borderRadius: 0 }}
                      itemStyle={{ color: '#e7ebf3' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="rows-in grid grid-cols-2 gap-x-4 gap-y-1.5 px-5 pb-5 text-xs">
                {summary.sectorBreakdown.slice(0, 8).map((s, i) => (
                  <li key={s.sector} className="flex items-center gap-2 text-ink-400">
                    <span className="h-2 w-2 shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="truncate">{s.sector}</span>
                    <span className="ml-auto text-ink-500">{s.count}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Top tickers">
              <ul className="rows-in pb-3">
                {summary.topTickers.map((t, i) => (
                  <li key={t.ticker}>
                    <Link
                      to={`/insiders/ticker/${encodeURIComponent(t.ticker)}`}
                      className="flex items-center justify-between px-5 py-2 text-sm transition-colors hover:bg-brand-500/[0.06]"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-4 text-xs text-ink-600">{i + 1}</span>
                        <span className="font-mono font-semibold text-ink-100">{t.ticker}</span>
                      </span>
                      <span className="text-ink-400">{t.count} trades</span>
                    </Link>
                  </li>
                ))}
                {summary.topTickers.length === 0 && (
                  <li className="px-5 py-6 text-center text-sm text-ink-500">No ticker-linked trades</li>
                )}
              </ul>
            </Card>
          </aside>
        )}

        <Card title="Trades" className={summary ? 'xl:col-span-2' : 'xl:col-span-3'}>
          {loading ? (
            <TableSkeleton rows={8} />
          ) : trades ? (
            <>
              <TradeTable trades={trades.content} hideMember />
              <Pagination
                page={trades.page}
                totalPages={trades.totalPages}
                totalElements={trades.totalElements}
                onPageChange={setPage}
              />
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
