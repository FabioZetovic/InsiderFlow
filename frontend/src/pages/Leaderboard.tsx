import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Trophy } from 'lucide-react';
import { getLeaderboard } from '../api';
import { chamberLabel, type LeaderboardResponse } from '../types';
import { Card, EmptyState, ErrorState, PartyBadge, TableSkeleton } from '../components/ui';

function ReturnCell({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`font-semibold ${up ? 'text-up-400' : 'text-down-400'}`}>
      {up ? '+' : ''}
      {value.toFixed(2)}%
    </span>
  );
}

export function Leaderboard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLeaderboard()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load the leaderboard.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  // While the backend computes (first run takes a few minutes of price lookups), poll.
  useEffect(() => {
    if (!data?.computing) return;
    const handle = setInterval(() => {
      getLeaderboard()
        .then((d) => {
          setData(d);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(handle);
  }, [data?.computing]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-100">
          <Trophy className="h-6 w-6 text-accent-400" />
          Trader Leaderboard
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Members ranked by the average return of their disclosed buys from the last 12 months,
          measured to the latest close. Only members with 5+ scored buys are ranked.
          {data?.computedAt && (
            <span className="ml-1 text-ink-600">
              Computed {format(parseISO(data.computedAt), 'MMM d, HH:mm')}.
            </span>
          )}
        </p>
      </div>

      <Card>
        {loading && !data ? (
          <TableSkeleton rows={10} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data && data.entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium text-right">Scored buys</th>
                  <th className="px-4 py-3 font-medium text-right">Avg return</th>
                  <th className="px-4 py-3 font-medium text-right" title="Return in excess of the S&P 500 over the same holding period">
                    Alpha vs SPY
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Best trade</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry, i) => (
                  <tr
                    key={entry.member}
                    className="border-t border-ink-800/60 even:bg-ink-900/40 hover:bg-ink-800/40 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-ink-500">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/insiders/member/${encodeURIComponent(entry.member)}`}
                          className="font-medium text-ink-200 hover:text-brand-400"
                        >
                          {entry.member}
                        </Link>
                        <PartyBadge party={entry.party} />
                      </div>
                      <span className="text-xs text-ink-500">
                        {chamberLabel(entry.chamber)}
                        {entry.state ? ` · ${entry.state}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink-300">{entry.scoredBuys}</td>
                    <td className="px-4 py-2.5 text-right">
                      <ReturnCell value={entry.avgReturnPercent} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ReturnCell value={entry.avgAlphaPercent} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {entry.bestTicker ? (
                        <Link
                          to={`/insiders/ticker/${encodeURIComponent(entry.bestTicker)}`}
                          className="font-mono text-ink-300 hover:text-brand-400"
                        >
                          {entry.bestTicker}
                        </Link>
                      ) : (
                        <span className="text-ink-600">—</span>
                      )}{' '}
                      <ReturnCell value={entry.bestReturnPercent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : data?.computing ? (
          <div className="px-4 py-12 text-center text-sm text-ink-400">
            Crunching returns against price history — this takes a few minutes on first run.
            The page refreshes automatically.
          </div>
        ) : (
          <EmptyState message="No ranked members yet — the leaderboard computes after the next ingest." />
        )}
      </Card>
    </div>
  );
}
