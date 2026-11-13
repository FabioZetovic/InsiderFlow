import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { chamberLabel, type SpotlightMember } from '../types';
import { CountUp, PartyBadge, Skeleton, TypeBadge } from './ui';
import { useOpenTrade } from './TradeDrawer';

/** Party-flavored tint per featured member. */
const ACCENTS: Record<string, { bg: string; text: string; chip: string }> = {
  'Nancy Pelosi': {
    bg: 'bg-gradient-to-br from-blue-500/12 via-ink-900/60 to-ink-900/60',
    text: 'text-blue-400',
    chip: 'bg-blue-500/15 text-blue-300',
  },
  'Donald Trump': {
    bg: 'bg-gradient-to-br from-down-500/12 via-ink-900/60 to-ink-900/60',
    text: 'text-down-400',
    chip: 'bg-down-500/15 text-down-300',
  },
};

const DEFAULT_ACCENT = { bg: 'bg-ink-900/60', text: 'text-ink-300', chip: 'bg-ink-800 text-ink-300' };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function SpotlightCard({ member }: { member: SpotlightMember }) {
  const navigate = useNavigate();
  const openTrade = useOpenTrade();
  const accent = ACCENTS[member.name] ?? DEFAULT_ACCENT;

  return (
    <div className={`lift p-5 ${accent.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${accent.chip}`}>
          {initials(member.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-ink-50">{member.name}</span>
            <PartyBadge party={member.party} />
          </div>
          <div className="text-xs text-ink-500">
            {member.found
              ? `${chamberLabel(member.chamber)}${member.state ? ` · ${member.state}` : ''} · ${member.tradeCount.toLocaleString()} trades`
              : 'No trading disclosures found'}
          </div>
        </div>
        {member.found && (
          <div className="ml-auto flex shrink-0 gap-4 text-right">
            <div>
              <div className="text-lg font-bold text-up-400"><CountUp value={member.buyCount} /></div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500">Buys</div>
            </div>
            <div>
              <div className="text-lg font-bold text-down-400"><CountUp value={member.sellCount} /></div>
              <div className="text-[10px] uppercase tracking-wider text-ink-500">Sells</div>
            </div>
          </div>
        )}
      </div>

      {member.found ? (
        <>
          <ul className="rows-in mt-4 space-y-2">
            {member.recentTrades.slice(0, 3).map((trade) => (
              <li key={trade.id}>
                <button
                  onClick={() => openTrade(trade.id)}
                  className="flex w-full items-center gap-2 py-0.5 text-left text-sm transition-colors hover:bg-ink-800/40"
                  title="Open trade detail"
                >
                <TypeBadge type={trade.transactionType} />
                <span className="w-14 truncate font-mono font-semibold text-ink-100">{trade.ticker ?? '—'}</span>
                <span className="truncate text-xs text-ink-500">{trade.amountRange ?? ''}</span>
                <span className="ml-auto shrink-0 text-xs text-ink-500">
                  {format(parseISO(trade.transactionDate), 'MMM d, yyyy')}
                </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate(`/insiders/member/${encodeURIComponent(member.name)}`)}
            className={`mt-4 text-xs font-medium hover:underline ${accent.text}`}
          >
            View all {member.tradeCount.toLocaleString()} trades
          </button>
        </>
      ) : (
        <p className="mt-3 text-xs text-ink-500">
          STOCK Act periodic transaction reports cover members of Congress. {member.name} has no
          filings in the House/Senate disclosure data.
        </p>
      )}
    </div>
  );
}

export function SpotlightCards({ members, loading }: { members: SpotlightMember[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    );
  }
  if (members.length === 0) {
    return null;
  }
  return (
    <div className="stagger grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1">
      {members.map((m) => (
        <SpotlightCard key={m.name} member={m} />
      ))}
    </div>
  );
}
