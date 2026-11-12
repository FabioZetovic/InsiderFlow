import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Chamber, MemberStats, SectorStats, TransactionType } from '../types';

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
  onChange: (patch: Partial<{
    member: string;
    sector: string;
    chamber: Chamber | '';
    type: TransactionType | '';
    search: string;
    from: string;
    to: string;
  }>) => void;
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | '';
  onChange: (value: T | '') => void;
}) {
  return (
    <div className="flex text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
          className={`px-3 py-1.5 font-medium transition-colors ${
            value === opt.value ? 'bg-brand-600 text-white' : 'bg-ink-900/80 text-ink-400 hover:bg-ink-800 hover:text-ink-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({ members, sectors, member, sector, chamber, type, search, from, to, onChange }: FilterBarProps) {
  const [memberQuery, setMemberQuery] = useState('');
  const [memberOpen, setMemberOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(search);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce ticker/company search so we don't fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft !== search) {
        onChange({ search: searchDraft });
      }
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => {
    setSearchDraft(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMemberOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.toLowerCase();
    return members.filter((m) => m.member.toLowerCase().includes(q)).slice(0, 50);
  }, [members, memberQuery]);

  const dateInputClass =
    ' bg-ink-900/80 px-2 py-1.5 text-sm text-ink-300 hover:bg-ink-800/80 focus:outline-none [color-scheme:dark]';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Ticker / company search */}
      <div className="flex items-center gap-2 bg-ink-900/80 px-3 py-1.5 hover:bg-ink-800/80 focus-within:ring-1 focus-within:ring-brand-500/60">
        <Search className="h-4 w-4 shrink-0 text-ink-500" />
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search ticker or company…"
          className="w-44 bg-transparent text-sm focus:outline-none placeholder:text-ink-600"
        />
        {searchDraft && (
          <button onClick={() => setSearchDraft('')} className="text-ink-600 hover:text-ink-400">
            <span className="text-xs">Clear</span>
          </button>
        )}
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5 text-xs text-ink-500">
        <input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value })}
          className={dateInputClass}
          title="From date"
        />
        <span>–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange({ to: e.target.value })}
          className={dateInputClass}
          title="To date"
        />
      </div>

      {/* Searchable member dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setMemberOpen((o) => !o)}
          className="flex items-center gap-2 bg-ink-900/80 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800/80 min-w-52 justify-between"
        >
          <span className="truncate">{member || 'All members'}</span>
          <ChevronDown className="w-4 h-4 text-ink-500 shrink-0" />
        </button>
        {memberOpen && (
          <div className="animate-fade absolute z-30 mt-1 w-72 bg-ink-800 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-2 px-3 py-2">
              <Search className="w-4 h-4 text-ink-500" />
              <input
                autoFocus
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search members…"
                className="w-full bg-transparent text-sm focus:outline-none placeholder:text-ink-600"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {member && (
                <li>
                  <button
                    onClick={() => {
                      onChange({ member: '' });
                      setMemberOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-ink-400 hover:bg-ink-800"
                  >
                    Clear member filter
                  </button>
                </li>
              )}
              {filteredMembers.map((m) => (
                <li key={m.member}>
                  <button
                    onClick={() => {
                      onChange({ member: m.member });
                      setMemberOpen(false);
                      setMemberQuery('');
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm text-ink-200 hover:bg-ink-700/60 flex justify-between gap-2"
                  >
                    <span className="truncate">{m.member}</span>
                    <span className="text-xs text-ink-500 shrink-0">{m.tradeCount}</span>
                  </button>
                </li>
              ))}
              {filteredMembers.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink-500">No matches</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Sector dropdown */}
      <select
        value={sector}
        onChange={(e) => onChange({ sector: e.target.value })}
        className="bg-ink-900/80 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-800/80 focus:outline-none max-w-56"
      >
        <option value="">All sectors</option>
        {sectors.map((s) => (
          <option key={s.sector} value={s.sector}>
            {s.sector} ({s.tradeCount})
          </option>
        ))}
      </select>

      <ToggleGroup<Chamber>
        options={[
          { label: 'House', value: 'HOUSE' },
          { label: 'Senate', value: 'SENATE' },
          { label: 'President', value: 'EXECUTIVE' },
        ]}
        value={chamber}
        onChange={(v) => onChange({ chamber: v })}
      />

      <ToggleGroup<TransactionType>
        options={[
          { label: 'Buys', value: 'BUY' },
          { label: 'Sells', value: 'SELL' },
        ]}
        value={type}
        onChange={(v) => onChange({ type: v })}
      />

      {(member || sector || chamber || type || search || from || to) && (
        <button
          onClick={() => onChange({ member: '', sector: '', chamber: '', type: '', search: '', from: '', to: '' })}
          className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-300 transition-colors"
        >

          Clear all
        </button>
      )}
    </div>
  );
}
