import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { compareMembers, getMembers } from '../api';
import type { MemberComparison, MemberStats } from '../types';
import { Avatar, Card, ErrorState, formatMoney, PageHeader, PartyBadge, SearchField, Skeleton } from '../components/ui';
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

  // With an empty query, offer the most active members so the list is useful straight away.
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allMembers
      .filter((m) => !selected.includes(m.member) && (!q || m.member.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [query, allMembers, selected]);

  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => pickerRef.current && !pickerRef.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="stagger space-y-8">
      {/* Own stacking layer above the cards, so the suggestion list is never covered. */}
      <div className="relative z-30">
        <PageHeader title="Compare Members" description="Put up to 3 members side by side." />
        <div className="mt-6 flex flex-wrap items-center gap-2 bg-ink-900/60 p-4">
          {selected.map((m) => {
            const info = allMembers.find((x) => x.member === m);
            return (
              <span key={m} className="animate-fade inline-flex items-center gap-2.5 bg-ink-800/80 py-1.5 pr-1.5 pl-2 text-sm text-ink-100">
                <Avatar name={m} party={info?.party} size="sm" />
                <span className="max-w-56 truncate">{m}</span>
                <button
                  onClick={() => setSelected(selected.filter((x) => x !== m))}
                  className="flex h-6 w-6 items-center justify-center text-ink-400 hover:bg-down-500/20 hover:text-down-300"
                  title={`Remove ${m}`}
                  aria-label={`Remove ${m}`}
                >
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              </span>
            );
          })}
          {selected.length < 3 ? (
            <div className="relative w-full sm:w-80" ref={pickerRef} onFocusCapture={() => setOpen(true)}>
              <SearchField
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setOpen(true);
                }}
                placeholder={selected.length === 0 ? 'Add a member to compare' : 'Add another member'}
              />
              {open && suggestions.length > 0 && (
                <ul className="animate-fade absolute left-0 z-40 mt-2 max-h-80 w-full overflow-y-auto bg-ink-800 py-1 shadow-2xl shadow-black/60 ring-1 ring-white/5">
                  {suggestions.map((m) => (
                    <li key={m.member}>
                      <button
                        onClick={() => {
                          setSelected([...selected, m.member]);
                          setQuery('');
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-ink-700/70"
                      >
                        <Avatar name={m.member} party={m.party} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm text-ink-100">
                            <span className="truncate">{m.member}</span>
                            <PartyBadge party={m.party} />
                          </span>
                          <span className="block text-[11px] text-ink-500">
                            {chamberLabel(m.chamber)}
                            {m.state ? ` · ${m.state}` : ''} · {m.tradeCount.toLocaleString()} trades
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <span className="text-xs text-ink-500">Three members selected. Remove one to add another.</span>
          )}
        </div>
      </div>

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
              <div className="h-52 overflow-hidden p-2">
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
