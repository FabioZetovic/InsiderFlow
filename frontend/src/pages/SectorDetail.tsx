import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getSectorTimeline, getTrades } from '../api';
import type { PagedResponse, TimelinePoint, Trade } from '../types';
import { TradeTable } from '../components/TradeTable';
import { Pagination } from '../components/Pagination';
import { Card, ErrorState, Skeleton, TableSkeleton } from '../components/ui';

export function SectorDetail() {
  const { sector = '' } = useParams();
  const [timeline, setTimeline] = useState<TimelinePoint[] | null>(null);
  const [trades, setTrades] = useState<PagedResponse<Trade> | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getSectorTimeline(sector), getTrades({ sector, page, size: 25 })])
      .then(([tl, t]) => {
        if (!cancelled) {
          setTimeline(tl);
          setTrades(t);
        }
      })
      .catch(() => {
        if (!cancelled) setError(`Failed to load data for sector ${sector}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sector, page]);

  useEffect(() => load(), [load]);

  // Last 36 months keeps the chart readable for long-running sectors.
  const chartData = useMemo(() => (timeline ?? []).slice(-36), [timeline]);

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="stagger space-y-8">
      <Link to="/corporate" className="inline-block text-sm text-ink-400 transition-colors hover:text-brand-300">
        Back to all trades
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-ink-50">{sector}</h1>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-5">
      <Card title="Buy and sell volume over time" className="xl:col-span-2">
        {loading && !timeline ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="h-72 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232a3f" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: '#6b7592', fontSize: 11 }} stroke="#343c55" />
                <YAxis tick={{ fill: '#6b7592', fontSize: 11 }} stroke="#343c55" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#161c2d', border: 'none', borderRadius: 0 }}
                  itemStyle={{ color: '#e7ebf3' }}
                  labelStyle={{ color: '#8b95ad' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
                <Bar dataKey="buyCount" name="Buys" fill="#22b673" animationDuration={900} />
                <Bar dataKey="sellCount" name="Sells" fill="#e5484d" animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Trades" className="xl:col-span-3">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : trades ? (
          <>
            <TradeTable trades={trades.content} />
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
