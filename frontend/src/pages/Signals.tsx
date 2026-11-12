import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getClusters, getLateFilers } from '../api';
import type { Cluster, LateFiler } from '../types';
import { Card, EmptyState, ErrorState, formatMoney, PageHeader, PartyBadge, TableSkeleton } from '../components/ui';

function LateFilersCard() {
  const [rows, setRows] = useState<LateFiler[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    getLateFilers()
      .then(setRows)
      .catch(() => setError(true));
  }, []);
  useEffect(() => load(), [load]);

  return (
    <Card title="STOCK Act late filers">
      <p className="px-4 pt-3 text-xs text-ink-500">
        The STOCK Act requires disclosure within 45 days of a trade. Members ranked by how many
        disclosures came in late.
      </p>
      {error ? (
        <ErrorState message="Failed to load late filers." onRetry={load} />
      ) : !rows ? (
        <TableSkeleton rows={8} />
      ) : rows.length === 0 ? (
        <EmptyState message="No late disclosures found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="rows-in w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                <th className="px-4 pt-4 pb-3 font-medium">Member</th>
                <th className="px-4 pt-4 pb-3 font-medium text-right">Late</th>
                <th className="px-4 pt-4 pb-3 font-medium text-right">Late rate</th>
                <th className="px-4 pt-4 pb-3 font-medium text-right">Avg lag</th>
                <th className="px-4 pt-4 pb-3 font-medium text-right">Worst</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map((r) => (
                <tr key={r.member} className="even:bg-ink-950/30 transition-colors hover:bg-brand-500/[0.06]">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/insiders/member/${encodeURIComponent(r.member)}`}
                        className="text-ink-200 hover:text-brand-400"
                      >
                        {r.member}
                      </Link>
                      <PartyBadge party={r.party} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-ink-300">
                    {r.lateCount}
                    <span className="text-xs text-ink-600"> / {r.totalDisclosed}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={r.lateRate > 50 ? 'font-semibold text-accent-400' : 'text-ink-400'}>
                      {r.lateRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-ink-400">{r.avgLagDays.toFixed(0)}d</td>
                  <td className="px-4 py-2 text-right text-ink-500">{r.maxLagDays}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ClustersCard() {
  const [days, setDays] = useState(90);
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [rows, setRows] = useState<Cluster[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setRows(null);
    getClusters(days, direction)
      .then(setRows)
      .catch(() => setError(true));
  }, [days, direction]);
  useEffect(() => load(), [load]);

  return (
    <Card title="Buy / sell clusters">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 text-xs">
        <span className="text-ink-500">Multiple members trading the same ticker within ~2 weeks.</span>
        <div className="ml-auto flex gap-1">
          {(['BUY', 'SELL'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`px-2 py-1 font-medium ${
                direction === d ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-400'
              }`}
            >
              {d === 'BUY' ? 'Buys' : 'Sells'}
            </button>
          ))}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-ink-900/80 px-2 py-1 text-ink-300"
          >
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={180}>180d</option>
          </select>
        </div>
      </div>
      {error ? (
        <ErrorState message="Failed to load clusters." onRetry={load} />
      ) : !rows ? (
        <TableSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState message="No clusters in this window." />
      ) : (
        <ul className="rows-in">
          {rows.map((c) => (
            <li key={`${c.ticker}-${c.direction}`} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Link
                  to={`/insiders/ticker/${encodeURIComponent(c.ticker)}`}
                  className="font-mono text-base font-semibold text-ink-100 hover:text-brand-400"
                >
                  {c.ticker}
                </Link>
                <span className="bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-300">
                  {c.memberCount} members
                </span>
                <span className="text-xs text-ink-500">{c.sector}</span>
                <span className="ml-auto text-xs text-ink-500">
                  {c.firstDate} to {c.lastDate} · {formatMoney(c.estimatedVolume)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.members.map((m, i) => (
                  <span
                    key={`${m.member}-${i}`}
                    className="inline-flex items-center gap-1 bg-ink-800/70 px-1.5 py-0.5 text-xs text-ink-300"
                  >
                    {m.member}
                    <PartyBadge party={m.party} />
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Signals() {
  return (
    <div className="stagger space-y-8">
      <PageHeader title="Signals" description="Accountability and pattern signals: who files late, and where members are piling in together." />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <LateFilersCard />
        <ClustersCard />
      </div>
    </div>
  );
}
