import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Star } from 'lucide-react';
import { chamberLabel, type SpotlightMember } from '../types';
import { PartyBadge, Skeleton, TypeBadge } from './ui';

/** Accent styling per featured member (party-flavored). */
const ACCENTS: Record<string, { ring: string; text: string; chip: string }> = {
  'Nancy Pelosi': {
    ring: 'ring-blue-500/40 bg-gradient-to-br from-blue-500/10 to-transparent',
    text: 'text-blue-400',
    chip: 'bg-blue-500/15 text-blue-300',
  },
  'Donald Trump': {
    ring: 'ring-red-500/40 bg-gradient-to-br from-red-500/10 to-transparent',
    text: 'text-red-400',
    chip: 'bg-red-500/15 text-red-300',
  },
};

const DEFAULT_ACCENT = {
  ring: 'ring-zinc-700 bg-zinc-900/50',
  text: 'text-zinc-300',
  chip: 'bg-zinc-800 text-zinc-300',
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function SpotlightCard({ member }: { member: SpotlightMember }) {
  const navigate = useNavigate();
  const accent = ACCENTS[member.name] ?? DEFAULT_ACCENT;

  return (
    <div className={`rounded-lg ring-1 p-4 ${accent.ring}`}>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold ${accent.chip}`}
        >
          {initials(member.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Star className={`h-3.5 w-3.5 ${accent.text}`} fill="currentColor" />
            <span className="truncate font-semibold text-zinc-100">{member.name}</span>
            <PartyBadge party={member.party} />
          </div>
          <div className="text-xs text-zinc-500">
            {member.found
              ? `${chamberLabel(member.chamber)}${member.state ? ` · ${member.state}` : ''} · ${member.tradeCount.toLocaleString()} trades`
              : 'No trading disclosures found'}
          </div>
        </div>
        {member.found && (
          <div className="ml-auto flex shrink-0 gap-4 text-right">
            <div>
              <div className="text-lg font-bold text-emerald-400">{member.buyCount.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Buys</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">{member.sellCount.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Sells</div>
            </div>
          </div>
        )}
      </div>

      {member.found ? (
        <>
          <ul className="mt-3 space-y-1.5">
            {member.recentTrades.map((trade) => (
              <li key={trade.id} className="flex items-center gap-2 text-sm">
                <TypeBadge type={trade.transactionType} />
                <span className="font-mono font-semibold text-zinc-100 w-14 truncate">
                  {trade.ticker ?? '—'}
                </span>
                <span className="truncate text-xs text-zinc-500">{trade.amountRange ?? ''}</span>
                <span className="ml-auto shrink-0 text-xs text-zinc-500">
                  {format(parseISO(trade.transactionDate), 'MMM d, yyyy')}
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate(`/insiders/member/${encodeURIComponent(member.name)}`)}
            className={`mt-3 text-xs font-medium hover:underline ${accent.text}`}
          >
            View all {member.tradeCount.toLocaleString()} trades →
          </button>
        </>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          STOCK Act periodic transaction reports cover members of Congress — {member.name} has no
          filings in the House/Senate disclosure data.
        </p>
      )}
    </div>
  );
}

export function SpotlightCards({ members, loading }: { members: SpotlightMember[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (members.length === 0) {
    return null;
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {members.map((m) => (
        <SpotlightCard key={m.name} member={m} />
      ))}
    </div>
  );
}
