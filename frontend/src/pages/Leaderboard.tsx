import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { getLeaderboard } from '../api';
import { chamberLabel, type LeaderboardResponse } from '../types';
import { Card, EmptyState, ErrorState, PageHeader, PartyBadge, SectionLabel, TableSkeleton } from '../components/ui';

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
    <div className="stagger space-y-8">
      <PageHeader
        title="Trader Leaderboard"
        description={
          <>
            Members ranked by the average return of their disclosed buys from the last 12 months,
            measured to the latest close.
            {data?.computedAt && (
              <span className="ml-1 text-ink-500">Computed {format(parseISO(data.computedAt), 'MMM d, HH:mm')}.</span>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
      <aside className="stagger space-y-3 xl:order-2">
        <SectionLabel>Top alpha</SectionLabel>
        {(data?.entries ?? [])
          .slice()
          .sort((a, b) => b.avgAlphaPercent - a.avgAlphaPercent)
          .slice(0, 3)
          .map((e, i) => (
            <Link
              key={e.member}
              to={`/insiders/member/${encodeURIComponent(e.member)}`}
              className="lift block bg-ink-900/60 p-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-ink-500">No. {i + 1}</span>
                <ReturnCell value={e.avgAlphaPercent} />
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="truncate font-semibold text-ink-50">{e.member}</span>
                <PartyBadge party={e.party} />
              </div>
              <div className="text-xs text-ink-500">{e.scoredBuys} scored buys</div>
            </Link>
          ))}
        <p className="pt-2 text-xs leading-relaxed text-ink-500">
          Alpha is the return in excess of the S&amp;P 500 over the same holding window. Only members
          with 5 or more scored buys are ranked.
        </p>
      </aside>

      <Card className="xl:col-span-3 xl:order-1">
        {loading && !data ? (
          <TableSkeleton rows={10} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data && data.entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="rows-in w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                  <th className="px-4 pt-4 pb-3 font-medium">#</th>
                  <th className="px-4 pt-4 pb-3 font-medium">Member</th>
                  <th className="px-4 pt-4 pb-3 font-medium text-right">Scored buys</th>
                  <th className="px-4 pt-4 pb-3 font-medium text-right">Avg return</th>
                  <th className="px-4 pt-4 pb-3 font-medium text-right" title="Return in excess of the S&P 500 over the same holding period">
                    Alpha vs SPY
                  </th>
                  <th className="px-4 pt-4 pb-3 font-medium text-right">Best trade</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry, i) => (
                  <tr
                    key={entry.member}
                    className="even:bg-ink-950/30 transition-colors hover:bg-brand-500/[0.06]"
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
    </div>
  );
}
