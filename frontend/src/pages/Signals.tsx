import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, Users } from 'lucide-react';
import { getClusters, getLateFilers } from '../api';
import type { Cluster, LateFiler } from '../types';
import { Card, EmptyState, ErrorState, formatMoney, PartyBadge, TableSkeleton } from '../components/ui';

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
      <p className="px-4 pt-3 text-xs text-zinc-500">
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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium text-right">Late</th>
                <th className="px-4 py-2.5 font-medium text-right">Late rate</th>
                <th className="px-4 py-2.5 font-medium text-right">Avg lag</th>
                <th className="px-4 py-2.5 font-medium text-right">Worst</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 30).map((r) => (
                <tr key={r.member} className="border-t border-zinc-800/60 even:bg-zinc-900/40">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/insiders/member/${encodeURIComponent(r.member)}`}
                        className="text-zinc-200 hover:text-emerald-400"
                      >
                        {r.member}
                      </Link>
                      <PartyBadge party={r.party} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-300">
                    {r.lateCount}
                    <span className="text-xs text-zinc-600"> / {r.totalDisclosed}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className={r.lateRate > 50 ? 'font-semibold text-amber-400' : 'text-zinc-400'}>
                      {r.lateRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-400">{r.avgLagDays.toFixed(0)}d</td>
                  <td className="px-4 py-2 text-right text-zinc-500">{r.maxLagDays}d</td>
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
        <span className="text-zinc-500">Multiple members trading the same ticker within ~2 weeks.</span>
        <div className="ml-auto flex gap-1">
          {(['BUY', 'SELL'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`rounded px-2 py-1 font-medium ${
                direction === d ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {d === 'BUY' ? 'Buys' : 'Sells'}
            </button>
          ))}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300"
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
        <ul className="divide-y divide-zinc-800/60">
          {rows.map((c) => (
            <li key={`${c.ticker}-${c.direction}`} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Link
                  to={`/insiders/ticker/${encodeURIComponent(c.ticker)}`}
                  className="font-mono text-base font-semibold text-zinc-100 hover:text-emerald-400"
                >
                  {c.ticker}
                </Link>
                <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                  <Users className="h-3 w-3" />
                  {c.memberCount} members
                </span>
                <span className="text-xs text-zinc-500">{c.sector}</span>
                <span className="ml-auto text-xs text-zinc-500">
                  {c.firstDate} → {c.lastDate} · {formatMoney(c.estimatedVolume)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.members.map((m, i) => (
                  <span
                    key={`${m.member}-${i}`}
                    className="inline-flex items-center gap-1 rounded bg-zinc-800/60 px-1.5 py-0.5 text-xs text-zinc-300"
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
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          Signals
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Accountability and pattern signals: who files late, and where members are piling in together.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="flex items-start gap-2">
          <Clock className="mt-1 hidden h-0 w-0" />
          <div className="w-full">
            <LateFilersCard />
          </div>
        </div>
        <ClustersCard />
      </div>
    </div>
  );
}
