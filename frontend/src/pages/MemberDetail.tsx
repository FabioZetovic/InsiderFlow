import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getMemberSummary, getTrades } from '../api';
import type { MemberSummary, PagedResponse, Trade } from '../types';
import { TradeTable } from '../components/TradeTable';
import { Pagination } from '../components/Pagination';
import { Card, ErrorState, PartyBadge, Skeleton, TableSkeleton } from '../components/ui';
import { WatchButton } from '../components/WatchButton';

const PIE_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#6366f1', '#71717a',
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
    <div className="space-y-4">
      <Link to="/insiders" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
        <ArrowLeft className="w-4 h-4" /> All trades
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
              <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
                {summary.member}
                <PartyBadge party={summary.party} />
                <WatchButton type="member" value={summary.member} />
              </h1>
              <p className="text-sm text-zinc-500">
                {summary.party ? `${summary.party} · ` : ''}
                {summary.chamber === 'HOUSE'
                  ? 'House of Representatives'
                  : summary.chamber === 'EXECUTIVE'
                    ? 'President of the United States (OGE 278-T filings)'
                    : 'Senate'}
                {summary.state ? ` · ${summary.state}` : ''}
              </p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-2xl font-bold text-zinc-100">{summary.tradeCount.toLocaleString()}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Trades</div>
              </div>
              {summary.estimatedVolume > 0 && (
                <div>
                  <div className="text-2xl font-bold text-zinc-100">
                    ${(summary.estimatedVolume / 1_000_000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wider">Est. volume</div>
                </div>
              )}
              <div>
                <div className="text-2xl font-bold text-emerald-400">{summary.buyCount.toLocaleString()}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Buys</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{summary.sellCount.toLocaleString()}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Sells</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Sector breakdown">
              <div className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.sectorBreakdown}
                      dataKey="count"
                      nameKey="sector"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {summary.sectorBreakdown.map((entry, i) => (
                        <Cell key={entry.sector} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Top tickers">
              <ul className="divide-y divide-zinc-800/70">
                {summary.topTickers.map((t, i) => (
                  <li key={t.ticker} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                      <span className="font-mono font-semibold text-zinc-100">{t.ticker}</span>
                    </span>
                    <span className="text-zinc-400">{t.count} trades</span>
                  </li>
                ))}
                {summary.topTickers.length === 0 && (
                  <li className="px-4 py-6 text-sm text-zinc-500 text-center">No ticker-linked trades</li>
                )}
              </ul>
            </Card>
          </div>
        </>
      ) : null}

      <Card title="Trades">
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
  );
}
