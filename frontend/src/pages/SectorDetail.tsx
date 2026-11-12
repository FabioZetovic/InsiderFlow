import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
    <div className="space-y-4">
      <Link to="/insiders" className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-200">
        <ArrowLeft className="w-4 h-4" /> All trades
      </Link>

      <h1 className="text-2xl font-bold text-ink-100">{sector}</h1>

      <Card title="Buy / sell volume over time">
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
                  contentStyle={{ background: '#161c2d', border: '1px solid #343c55', borderRadius: 8 }}
                  itemStyle={{ color: '#e7ebf3' }}
                  labelStyle={{ color: '#8b95ad' }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="buyCount" name="Buys" fill="#22b673" radius={[2, 2, 0, 0]} />
                <Bar dataKey="sellCount" name="Sells" fill="#e5484d" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Trades">
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
  );
}
