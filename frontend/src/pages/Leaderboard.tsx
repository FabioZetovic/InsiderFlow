import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { getLeaderboard } from '../api';
import { chamberLabel, type Chamber, type LeaderboardEntry, type LeaderboardResponse } from '../types';
import { Avatar, Card, CountUp, EmptyState, ErrorState, FieldLabel, PageHeader, PartyBadge, SearchField, Segmented, Skeleton, TableSkeleton } from '../components/ui';

type Metric = 'return' | 'alpha' | 'buys';

const METRICS: Record<Metric, { label: string; value: (e: LeaderboardEntry) => number; percent: boolean }> = {
  return: { label: 'Avg return', value: (e) => e.avgReturnPercent, percent: true },
  alpha: { label: 'Alpha vs S&P 500', value: (e) => e.avgAlphaPercent, percent: true },
  buys: { label: 'Scored buys', value: (e) => e.scoredBuys, percent: false },
};

const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

function Pct({ value, className = '' }: { value: number; className?: string }) {
  return <span className={`font-semibold tabular-nums ${value >= 0 ? 'text-up-400' : 'text-down-400'} ${className}`}>{pct(value)}</span>;
}

/** Value with a bar that grows right (gain) or left (loss) from a centre line. */
function Diverging({ value, maxAbs }: { value: number; maxAbs: number }) {
  const w = Math.min(Math.abs(value) / Math.max(maxAbs, 0.0001), 1) * 50;
  const up = value >= 0;
  return (
    <div className="w-40">
      <Pct value={value} />
      <div className="relative mt-1.5 h-1.5 bg-ink-800/80">
        <span className="absolute inset-y-0 left-1/2 w-px bg-ink-600" />
        <span
          className={`bar-grow absolute inset-y-0 ${up ? 'left-1/2 bg-up-500' : 'right-1/2 bg-down-500'}`}
          style={{ width: `${w}%`, transformOrigin: up ? 'left' : 'right' }}
        />
      </div>
    </div>
  );
}

const PODIUM_STYLE = [
  { ring: 'from-accent-500/30', text: 'text-accent-300', tag: 'bg-accent-500 text-ink-950', height: 'lg:pt-10' },
  { ring: 'from-brand-500/30', text: 'text-brand-300', tag: 'bg-brand-500 text-white', height: 'lg:pt-5' },
  { ring: 'from-secondary-500/25', text: 'text-secondary-300', tag: 'bg-secondary-500 text-ink-950', height: 'lg:pt-3' },
];

function PodiumCard({ entry, rank, metric }: { entry: LeaderboardEntry; rank: number; metric: Metric }) {
  const style = PODIUM_STYLE[rank - 1];
  const m = METRICS[metric];
  const v = m.value(entry);
  return (
    <Link
      to={`/insiders/member/${encodeURIComponent(entry.member)}`}
      className={`lift relative flex flex-col overflow-hidden bg-gradient-to-b ${style.ring} via-ink-900/70 to-ink-900/70 p-6 ${
        rank === 1 ? 'lg:order-2' : rank === 2 ? 'lg:order-1 lg:mt-8' : 'lg:order-3 lg:mt-12'
      }`}
    >
      <span className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold ${style.tag}`}>No. {rank}</span>
      <div className="flex items-center gap-3">
        <Avatar name={entry.member} party={entry.party} size="lg" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-lg font-semibold text-ink-50">{entry.member}</span>
            <PartyBadge party={entry.party} />
          </div>
          <div className="text-xs text-ink-500">
            {chamberLabel(entry.chamber)}
            {entry.state ? ` · ${entry.state}` : ''}
          </div>
        </div>
      </div>
      <div className="mt-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{m.label}</div>
        <div className={`mt-1 text-4xl font-bold tabular-nums ${m.percent ? (v >= 0 ? 'text-up-400' : 'text-down-400') : style.text}`}>
          <CountUp value={v} format={(n) => (m.percent ? pct(n) : Math.round(n).toLocaleString())} />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-ink-500">Avg return</div>
          <Pct value={entry.avgReturnPercent} />
        </div>
        <div>
          <div className="text-ink-500">Alpha</div>
          <Pct value={entry.avgAlphaPercent} />
        </div>
        <div>
          <div className="text-ink-500">Best trade</div>
          <span className="font-mono font-semibold text-ink-100">{entry.bestTicker ?? '—'}</span>
        </div>
      </div>
    </Link>
  );
}

export function Leaderboard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('return');
  const [chamber, setChamber] = useState<Chamber | ''>('');
  const [query, setQuery] = useState('');

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
        .then(setData)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(handle);
  }, [data?.computing]);

  // Rank within the chosen metric + chamber; the search only narrows the table, not the ranks.
  const ranked = useMemo(() => {
    const value = METRICS[metric].value;
    return (data?.entries ?? [])
      .filter((e) => !chamber || e.chamber === chamber)
      .slice()
      .sort((a, b) => value(b) - value(a))
      .map((e, i) => ({ e, rank: i + 1 }));
  }, [data, metric, chamber]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ranked.filter(({ e }) => e.member.toLowerCase().includes(q)) : ranked;
  }, [ranked, query]);

  const maxReturn = Math.max(...ranked.map(({ e }) => Math.abs(e.avgReturnPercent)), 1);
  const maxAlpha = Math.max(...ranked.map(({ e }) => Math.abs(e.avgAlphaPercent)), 1);
  const podium = ranked.slice(0, 3);

  return (
    <div className="stagger space-y-8">
      <PageHeader
        title="Trader Leaderboard"
        description={
          <>
            Members ranked by how their disclosed buys from the last 12 months have performed, measured to the latest close.
            {data?.computedAt && (
              <span className="ml-1 text-ink-500">Updated {format(parseISO(data.computedAt), 'MMM d, HH:mm')}.</span>
            )}
          </>
        }
      />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 bg-ink-900/60 p-5">
        <div>
          <FieldLabel>Rank by</FieldLabel>
          <Segmented<Metric>
            options={[
              { label: 'Avg return', value: 'return' },
              { label: 'Alpha vs S&P', value: 'alpha' },
              { label: 'Most buys', value: 'buys' },
            ]}
            value={metric}
            onChange={(v) => setMetric((v || 'return') as Metric)}
          />
        </div>
        <div>
          <FieldLabel>Chamber</FieldLabel>
          <Segmented<Chamber>
            options={[
              { label: 'All', value: '' },
              { label: 'House', value: 'HOUSE' },
              { label: 'Senate', value: 'SENATE' },
              { label: 'President', value: 'EXECUTIVE' },
            ]}
            value={chamber}
            onChange={setChamber}
          />
        </div>
        <div className="w-full sm:ml-auto sm:w-72">
          <FieldLabel>Find a member</FieldLabel>
          <SearchField value={query} onChange={setQuery} placeholder="Name" />
        </div>
      </div>

      {/* Podium */}
      {loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        podium.length > 0 && (
          <div key={`${metric}-${chamber}`} className="stagger grid items-start gap-4 lg:grid-cols-3">
            {podium.map(({ e, rank }) => (
              <PodiumCard key={e.member} entry={e} rank={rank} metric={metric} />
            ))}
          </div>
        )
      )}

      {/* Full ranking */}
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink-50">{visible.length}</span>
            <span className="text-sm text-ink-400">ranked members</span>
          </div>
          <span className="text-[11px] text-ink-500">Only members with 5 or more scored buys are ranked.</span>
        </div>
        {loading && !data ? (
          <TableSkeleton rows={10} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : visible.length > 0 ? (
          <div className="overflow-x-auto">
            <table key={`${metric}-${chamber}`} className="rows-in w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  <th className="px-4 pt-5 pb-3 pl-6">Rank</th>
                  <th className="px-4 pt-5 pb-3">Member</th>
                  <th className={`px-4 pt-5 pb-3 text-right ${metric === 'buys' ? 'text-brand-300' : ''}`}>Scored buys</th>
                  <th className={`px-4 pt-5 pb-3 ${metric === 'return' ? 'text-brand-300' : ''}`}>Avg return</th>
                  <th className={`px-4 pt-5 pb-3 ${metric === 'alpha' ? 'text-brand-300' : ''}`} title="Return in excess of the S&P 500 over the same holding period">
                    Alpha vs S&amp;P
                  </th>
                  <th className="px-4 pt-5 pb-3 pr-6 text-right">Best trade</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ e, rank }) => (
                  <tr key={e.member} className="group transition-colors hover:bg-brand-500/[0.06]">
                    <td className="py-3 pr-4 pl-6">
                      <span
                        className={`inline-flex h-7 min-w-7 items-center justify-center px-1.5 text-xs font-bold ${
                          rank === 1
                            ? 'bg-accent-500 text-ink-950'
                            : rank === 2
                              ? 'bg-brand-500 text-white'
                              : rank === 3
                                ? 'bg-secondary-500 text-ink-950'
                                : 'bg-ink-800/80 text-ink-400'
                        }`}
                      >
                        {rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/insiders/member/${encodeURIComponent(e.member)}`} className="flex items-center gap-3">
                        <Avatar name={e.member} party={e.party} size="sm" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium text-ink-100 hover:text-brand-300">{e.member}</span>
                            <PartyBadge party={e.party} />
                          </span>
                          <span className="block text-[11px] text-ink-500">
                            {chamberLabel(e.chamber)}
                            {e.state ? ` · ${e.state}` : ''}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-ink-200 tabular-nums">{e.scoredBuys.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Diverging value={e.avgReturnPercent} maxAbs={maxReturn} />
                    </td>
                    <td className="px-4 py-3">
                      <Diverging value={e.avgAlphaPercent} maxAbs={maxAlpha} />
                    </td>
                    <td className="px-4 py-3 pr-6 text-right whitespace-nowrap">
                      {e.bestTicker ? (
                        <Link
                          to={`/insiders/ticker/${encodeURIComponent(e.bestTicker)}`}
                          className="mr-2 bg-ink-800/80 px-2 py-0.5 font-mono text-[13px] font-semibold text-ink-50 transition-colors hover:bg-brand-500/20 hover:text-brand-200"
                        >
                          {e.bestTicker}
                        </Link>
                      ) : (
                        <span className="mr-2 text-ink-600">—</span>
                      )}
                      <Pct value={e.bestReturnPercent} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : data?.computing ? (
          <div className="px-6 py-12 text-center text-sm text-ink-400">
            Crunching returns against price history. This takes a few minutes on first run, and the page refreshes automatically.
          </div>
        ) : (
          <EmptyState message={query ? `No ranked member matches "${query}".` : 'No ranked members for this filter yet.'} />
        )}
        <p className="px-6 pt-2 pb-5 text-[11px] leading-relaxed text-ink-500">
          Return is measured from each buy's disclosed trade date to the latest close. Alpha subtracts the S&amp;P 500's
          return over the same window. Disclosures give amount ranges, so every buy is weighted equally.
        </p>
      </Card>
    </div>
  );
}
