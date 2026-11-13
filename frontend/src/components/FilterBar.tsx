import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO, startOfYear, subDays, subYears } from 'date-fns';
import type { Chamber, MemberStats, SectorStats, TransactionType } from '../types';
import { Avatar, FieldLabel, PartyBadge, SearchField, Segmented } from './ui';

type Patch = Partial<{
  member: string;
  sector: string;
  chamber: Chamber | '';
  type: TransactionType | '';
  search: string;
  from: string;
  to: string;
}>;

interface FilterBarProps {
  members: MemberStats[];
  sectors: SectorStats[];
  member: string;
  sector: string;
  chamber: Chamber | '';
  type: TransactionType | '';
  search: string;
  from: string;
  to: string;
  onChange: (patch: Patch) => void;
}

const ISO = 'yyyy-MM-dd';

const DATE_PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: 'Last 7 days', range: () => [format(subDays(new Date(), 7), ISO), ''] },
  { label: 'Last 30 days', range: () => [format(subDays(new Date(), 30), ISO), ''] },
  { label: 'Last 90 days', range: () => [format(subDays(new Date(), 90), ISO), ''] },
  { label: 'This year', range: () => [format(startOfYear(new Date()), ISO), ''] },
  { label: 'Last 12 months', range: () => [format(subYears(new Date(), 1), ISO), ''] },
];

function prettyDate(value: string): string {
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
}

function dateLabel(from: string, to: string): string {
  if (!from && !to) return 'Any time';
  const preset = DATE_PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  });
  if (preset) return preset.label;
  if (from && to) return `${prettyDate(from)} to ${prettyDate(to)}`;
  if (from) return `Since ${prettyDate(from)}`;
  return `Until ${prettyDate(to)}`;
}

/** Click-outside + Escape closing for a popover. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const TRIGGER =
  'flex w-full items-center justify-between gap-3 bg-ink-950/70 px-3.5 py-2.5 text-left text-sm ring-1 transition hover:bg-ink-950';
const PANEL = 'animate-fade absolute z-40 mt-2 bg-ink-800 shadow-2xl shadow-black/60 ring-1 ring-white/5';

function Caret({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-ink-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MemberPicker({ members, value, onChange }: { members: MemberStats[]; value: string; onChange: (m: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  const [query, setQuery] = useState('');
  const selected = members.find((m) => m.member === value);
  const list = useMemo(() => {
    const q = query.toLowerCase();
    return members.filter((m) => m.member.toLowerCase().includes(q)).slice(0, 60);
  }, [members, query]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={`${TRIGGER} ${open ? 'ring-brand-500/60' : 'ring-transparent'}`}>
        <span className="flex min-w-0 items-center gap-2.5">
          {value ? (
            <>
              <Avatar name={value} party={selected?.party} size="sm" />
              <span className="truncate text-ink-100">{value}</span>
            </>
          ) : (
            <span className="text-ink-400">All members</span>
          )}
        </span>
        <Caret open={open} />
      </button>
      {open && (
        <div className={`${PANEL} left-0 w-80`}>
          <div className="p-2">
            <SearchField value={query} onChange={setQuery} placeholder="Find a member" />
          </div>
          <ul className="max-h-80 overflow-y-auto pb-2">
            {value && (
              <li>
                <button
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-brand-300 hover:bg-ink-700/60"
                >
                  Show all members
                </button>
              </li>
            )}
            {list.map((m) => (
              <li key={m.member}>
                <button
                  onClick={() => {
                    onChange(m.member);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-ink-700/60 ${
                    m.member === value ? 'bg-brand-500/10' : ''
                  }`}
                >
                  <Avatar name={m.member} party={m.party} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm text-ink-100">
                      <span className="truncate">{m.member}</span>
                      <PartyBadge party={m.party} />
                    </span>
                    <span className="block text-[11px] text-ink-500">
                      {m.state ?? ''} · {m.tradeCount.toLocaleString()} trades
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-4 py-3 text-sm text-ink-500">No members match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function SectorPicker({ sectors, value, onChange }: { sectors: SectorStats[]; value: string; onChange: (s: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  const max = Math.max(1, ...sectors.map((s) => s.tradeCount));
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={`${TRIGGER} ${open ? 'ring-brand-500/60' : 'ring-transparent'}`}>
        <span className={`truncate ${value ? 'text-ink-100' : 'text-ink-400'}`}>{value || 'All sectors'}</span>
        <Caret open={open} />
      </button>
      {open && (
        <div className={`${PANEL} left-0 w-80`}>
          <ul className="max-h-96 overflow-y-auto py-2">
            <li>
              <button
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-ink-700/60 ${!value ? 'text-brand-300' : 'text-ink-300'}`}
              >
                All sectors
              </button>
            </li>
            {sectors.map((s) => (
              <li key={s.sector}>
                <button
                  onClick={() => {
                    onChange(s.sector);
                    setOpen(false);
                  }}
                  className={`block w-full px-4 py-2 text-left transition-colors hover:bg-ink-700/60 ${s.sector === value ? 'bg-brand-500/10' : ''}`}
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-ink-100">{s.sector}</span>
                    <span className="shrink-0 text-[11px] text-ink-500">{s.tradeCount.toLocaleString()}</span>
                  </span>
                  <span className="mt-1 block h-0.5 bg-ink-700">
                    <span className="block h-full bg-brand-500/70" style={{ width: `${(s.tradeCount / max) * 100}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DatePicker({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  const active = Boolean(from || to);
  const input =
    'w-full bg-ink-950/70 px-3 py-2 text-sm text-ink-100 ring-1 ring-transparent focus:ring-brand-500/60 focus:outline-none [color-scheme:dark]';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={`${TRIGGER} ${open ? 'ring-brand-500/60' : 'ring-transparent'}`}>
        <span className="flex items-center gap-2.5">
          <svg viewBox="0 0 20 20" className={`h-4 w-4 ${active ? 'text-brand-400' : 'text-ink-500'}`} fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4.5" width="14" height="12" />
            <path d="M3 8.5h14M7 3v3M13 3v3" strokeLinecap="round" />
          </svg>
          <span className={`truncate ${active ? 'text-ink-100' : 'text-ink-400'}`}>{dateLabel(from, to)}</span>
        </span>
        <Caret open={open} />
      </button>
      {open && (
        <div className={`${PANEL} right-0 w-80 p-4`}>
          <FieldLabel>Quick ranges</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {[{ label: 'Any time', range: (): [string, string] => ['', ''] }, ...DATE_PRESETS].map((p) => {
              const [f, t] = p.range();
              const on = f === from && t === to;
              return (
                <button
                  key={p.label}
                  onClick={() => {
                    onChange(f, t);
                    setOpen(false);
                  }}
                  className={`px-3 py-2 text-left text-xs font-medium transition-colors ${
                    on ? 'bg-brand-600 text-white' : 'bg-ink-950/60 text-ink-300 hover:bg-ink-700/70 hover:text-ink-50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <label>
              <FieldLabel>From</FieldLabel>
              <input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className={input} />
            </label>
            <label>
              <FieldLabel>To</FieldLabel>
              <input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className={input} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="animate-fade inline-flex items-center gap-2 bg-brand-500/15 py-1 pr-1 pl-2.5 text-xs text-brand-200">
      {label}
      <button
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center text-brand-300 hover:bg-brand-500/30 hover:text-white"
        title={`Remove ${label}`}
        aria-label={`Remove ${label}`}
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </button>
    </span>
  );
}

export function FilterBar({ members, sectors, member, sector, chamber, type, search, from, to, onChange }: FilterBarProps) {
  const [searchDraft, setSearchDraft] = useState(search);

  // Debounce ticker/company search so we don't fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft !== search) onChange({ search: searchDraft });
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => setSearchDraft(search), [search]);

  const chips: { label: string; clear: Patch }[] = [];
  if (search) chips.push({ label: `"${search}"`, clear: { search: '' } });
  if (member) chips.push({ label: member, clear: { member: '' } });
  if (sector) chips.push({ label: sector, clear: { sector: '' } });
  if (from || to) chips.push({ label: dateLabel(from, to), clear: { from: '', to: '' } });
  if (chamber) chips.push({ label: chamber === 'EXECUTIVE' ? 'President' : chamber === 'HOUSE' ? 'House' : 'Senate', clear: { chamber: '' } });
  if (type) chips.push({ label: type === 'BUY' ? 'Buys only' : 'Sells only', clear: { type: '' } });

  return (
    <div className="bg-ink-900/60 p-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-4">
          <FieldLabel>Ticker or company</FieldLabel>
          <SearchField value={searchDraft} onChange={setSearchDraft} placeholder="Search AAPL, Nvidia, Microsoft..." />
        </div>
        <div className="xl:col-span-3">
          <FieldLabel>Member</FieldLabel>
          <MemberPicker members={members} value={member} onChange={(m) => onChange({ member: m })} />
        </div>
        <div className="xl:col-span-3">
          <FieldLabel>Sector</FieldLabel>
          <SectorPicker sectors={sectors} value={sector} onChange={(s) => onChange({ sector: s })} />
        </div>
        <div className="md:col-span-2 xl:col-span-2">
          <FieldLabel>Trade date</FieldLabel>
          <DatePicker from={from} to={to} onChange={(f, t) => onChange({ from: f, to: t })} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
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
            onChange={(v) => onChange({ chamber: v })}
          />
        </div>
        <div>
          <FieldLabel>Side</FieldLabel>
          <Segmented<TransactionType>
            options={[
              { label: 'All', value: '' },
              { label: 'Buys', value: 'BUY' },
              { label: 'Sells', value: 'SELL' },
            ]}
            value={type}
            onChange={(v) => onChange({ type: v })}
          />
        </div>

        {chips.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <Chip key={c.label} label={c.label} onRemove={() => onChange(c.clear)} />
            ))}
            <button
              onClick={() => onChange({ member: '', sector: '', chamber: '', type: '', search: '', from: '', to: '' })}
              className="px-2 py-1 text-xs font-semibold text-ink-400 hover:text-ink-100"
            >
              Reset all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
