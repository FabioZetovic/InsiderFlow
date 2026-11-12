import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { compareMembers, getMembers } from '../api';
import type { MemberComparison, MemberStats } from '../types';
import { Card, ErrorState, formatMoney, PageHeader, PartyBadge, Skeleton } from '../components/ui';
import { chamberLabel } from '../types';

const PIE_COLORS = ['#7472f8', '#22b5d2', '#f6bd4f', '#3fd38c', '#f4707a', '#b1b4ff', '#93e4f3', '#ffd78f', '#86e3b4', '#ffa3aa', '#6b7592'];

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
    <div className="stagger space-y-8">
      <PageHeader title="Compare Members" description="Put up to 3 members side by side.">
        {/* Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((m) => (
            <span key={m} className="animate-fade inline-flex items-center gap-2 bg-ink-800/70 px-2.5 py-1 text-sm text-ink-200">
              {m}
              <button
                onClick={() => setSelected(selected.filter((x) => x !== m))}
                className="text-xs text-ink-500 hover:text-down-400"
                title={`Remove ${m}`}
              >
                Remove
              </button>
            </span>
          ))}
          {selected.length < 3 && (
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Add a member…"
                className="bg-ink-900/80 px-3 py-1.5 text-sm text-ink-200 focus:ring-1 focus:ring-brand-500/60 focus:outline-none"
              />
              {suggestions.length > 0 && (
                <ul className="animate-fade absolute z-20 mt-1 w-64 bg-ink-800 shadow-2xl shadow-black/50">
                  {suggestions.map((m) => (
                    <li key={m.member}>
                      <button
                        onClick={() => {
                          setSelected([...selected, m.member]);
                          setQuery('');
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-200 hover:bg-ink-800"
                      >
                        {m.member}
                        <PartyBadge party={m.party} />
                        <span className="ml-auto text-xs text-ink-500">{m.tradeCount}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </PageHeader>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : error ? (
        <ErrorState message="Failed to load comparison." />
      ) : data && data.members.length > 0 ? (
        <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.members.map((m) => (
            <Card key={m.member} className="lift">
              <div className="p-4">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-semibold text-ink-100">{m.member}</h2>
                  <PartyBadge party={m.party} />
                </div>
                <p className="text-xs text-ink-500">
                  {chamberLabel(m.chamber)}
                  {m.state ? ` · ${m.state}` : ''}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-ink-100">{m.tradeCount}</div>
                    <div className="text-[10px] uppercase text-ink-500">Trades</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-up-400">{m.buyCount}</div>
                    <div className="text-[10px] uppercase text-ink-500">Buys</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-ink-100">{formatMoney(m.estimatedVolume)}</div>
                    <div className="text-[10px] uppercase text-ink-500">Volume</div>
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
                    <Tooltip contentStyle={{ background: '#161c2d', border: 'none', borderRadius: 0 }} itemStyle={{ color: '#e7ebf3' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="rows-in p-4 text-sm">
                {m.topTickers.slice(0, 5).map((t) => (
                  <li key={t.ticker} className="flex justify-between py-0.5">
                    <span className="font-mono text-ink-300">{t.ticker}</span>
                    <span className="text-ink-500">{t.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-sm text-ink-500">Add members above to compare them.</p>
      )}
    </div>
  );
}
