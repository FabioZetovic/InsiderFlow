import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GitCompare, X } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { compareMembers, getMembers } from '../api';
import type { MemberComparison, MemberStats } from '../types';
import { Card, ErrorState, formatMoney, PartyBadge, Skeleton } from '../components/ui';
import { chamberLabel } from '../types';

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#6366f1', '#71717a'];

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allMembers, setAllMembers] = useState<MemberStats[]>([]);
  const [data, setData] = useState<MemberComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(() => searchParams.getAll('m'), [searchParams]);

  useEffect(() => {
    getMembers().then(setAllMembers).catch(() => {});
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(false);
    compareMembers(selected)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const setSelected = (members: string[]) => {
    const next = new URLSearchParams();
    members.slice(0, 3).forEach((m) => next.append('m', m));
    setSearchParams(next);
  };

  const suggestions = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return allMembers
      .filter((m) => m.member.toLowerCase().includes(q) && !selected.includes(m.member))
      .slice(0, 6);
  }, [query, allMembers, selected]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
          <GitCompare className="h-6 w-6 text-emerald-400" />
          Compare Members
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Put up to 3 members side by side.</p>
      </div>

      {/* Selector */}
      <Card>
        <div className="flex flex-wrap items-center gap-2 p-4">
          {selected.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-200">
              {m}
              <button onClick={() => setSelected(selected.filter((x) => x !== m))} className="text-zinc-500 hover:text-red-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {selected.length < 3 && (
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Add a member…"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 w-64 rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
                  {suggestions.map((m) => (
                    <li key={m.member}>
                      <button
                        onClick={() => {
                          setSelected([...selected, m.member]);
                          setQuery('');
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                      >
                        {m.member}
                        <PartyBadge party={m.party} />
                        <span className="ml-auto text-xs text-zinc-500">{m.tradeCount}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : error ? (
        <ErrorState message="Failed to load comparison." />
      ) : data && data.members.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.members.map((m) => (
            <Card key={m.member}>
              <div className="border-b border-zinc-800 p-4">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-semibold text-zinc-100">{m.member}</h2>
                  <PartyBadge party={m.party} />
                </div>
                <p className="text-xs text-zinc-500">
                  {chamberLabel(m.chamber)}
                  {m.state ? ` · ${m.state}` : ''}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-zinc-100">{m.tradeCount}</div>
                    <div className="text-[10px] uppercase text-zinc-500">Trades</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400">{m.buyCount}</div>
                    <div className="text-[10px] uppercase text-zinc-500">Buys</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-zinc-100">{formatMoney(m.estimatedVolume)}</div>
                    <div className="text-[10px] uppercase text-zinc-500">Volume</div>
                  </div>
                </div>
              </div>
              <div className="h-52 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={m.sectorBreakdown} dataKey="count" nameKey="sector" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {m.sectorBreakdown.map((s, i) => (
                        <Cell key={s.sector} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} itemStyle={{ color: '#e4e4e7' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="border-t border-zinc-800 p-3 text-sm">
                {m.topTickers.slice(0, 5).map((t) => (
                  <li key={t.ticker} className="flex justify-between py-0.5">
                    <span className="font-mono text-zinc-300">{t.ticker}</span>
                    <span className="text-zinc-500">{t.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-zinc-500">Add members above to compare them.</p>
      )}
    </div>
  );
}
