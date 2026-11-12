import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { getDigest } from '../api';
import { partyInitial, type Digest, type Party } from '../types';
import { CountUp, formatMoney, PartyBadge, Skeleton } from './ui';

const PARTY_AVATAR: Record<string, string> = {
  D: 'bg-blue-500/20 text-blue-300',
  R: 'bg-down-500/20 text-down-300',
  I: 'bg-ink-600/40 text-ink-200',
};

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function avatarClass(party: Party | null | undefined): string {
  return PARTY_AVATAR[partyInitial(party) ?? ''] ?? 'bg-brand-500/20 text-brand-300';
}

function Kpi({ label, children, tone = 'text-ink-50' }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="bg-ink-900/60 px-5 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone}`}>{children}</div>
    </div>
  );
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">{children}</h3>;
}

export function DigestPanel() {
  const navigate = useNavigate();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDigest()
      .then((d) => !cancelled && setDigest(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-px">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!digest || digest.newTrades === 0) {
    return null;
  }

  const buyShare = digest.newTrades > 0 ? (digest.newBuys / Math.max(digest.newBuys + digest.newSells, 1)) * 100 : 0;
  const tickers = digest.topTickers.slice(0, 5);
  const maxTickerTrades = Math.max(1, ...tickers.map((t) => t.buyCount + t.sellCount));
  const members = digest.topMembers.slice(0, 5);
  const maxMemberVolume = Math.max(1, ...members.map((m) => m.estimatedVolume));

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-400">Latest filings</h2>
        {digest.since && (
          <span className="flex items-center gap-1.5 text-xs text-ink-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-up-400" />
            </span>
            since {format(parseISO(digest.since), 'MMM d')}
          </span>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
        <Kpi label="New trades">
          <CountUp value={digest.newTrades} />
        </Kpi>
        <Kpi label="Buys" tone="text-up-400">
          <CountUp value={digest.newBuys} />
        </Kpi>
        <Kpi label="Sells" tone="text-down-400">
          <CountUp value={digest.newSells} />
        </Kpi>
        <Kpi label="Est. volume">
          <CountUp value={digest.estimatedVolume} format={(n) => formatMoney(n)} />
        </Kpi>
      </div>

      {/* Buy / sell balance */}
      <div className="bg-ink-900/60 px-5 pb-4 pt-1">
        <div className="flex h-1.5 w-full overflow-hidden bg-down-500/70">
          <div className="bar-grow h-full bg-up-500" style={{ width: `${buyShare}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-500">
          <span>{buyShare.toFixed(0)}% buys</span>
          <span>{(100 - buyShare).toFixed(0)}% sells</span>
        </div>
      </div>

      <div className="mt-px grid flex-1 grid-cols-1 gap-px md:grid-cols-3">
        {/* Biggest trades */}
        <div className="bg-ink-900/60 p-5">
          <ColumnTitle>Biggest trades</ColumnTitle>
          <ul className="rows-in space-y-1">
            {digest.notableTrades.slice(0, 5).map((t) => {
              const buy = t.transactionType === 'BUY';
              return (
                <li key={t.id}>
                  <button
                    onClick={() =>
                      t.ticker
                        ? navigate(`/insiders/ticker/${encodeURIComponent(t.ticker)}`)
                        : navigate(`/insiders/member/${encodeURIComponent(t.member)}`)
                    }
                    className="group flex w-full items-center gap-3 py-1.5 pr-1 text-left transition-colors hover:bg-ink-800/40"
                  >
                    <span className={`h-8 w-1 shrink-0 ${buy ? 'bg-up-500' : t.transactionType === 'SELL' ? 'bg-down-500' : 'bg-secondary-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-ink-50 group-hover:text-brand-300">
                          {t.ticker ?? 'Other asset'}
                        </span>
                        <span className={`text-[10px] font-semibold ${buy ? 'text-up-400' : 'text-down-400'}`}>
                          {t.transactionType}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-ink-500">{t.member}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-ink-300">{t.amountRange}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Most traded tickers */}
        <div className="bg-ink-900/60 p-5">
          <ColumnTitle>Most traded tickers</ColumnTitle>
          <ul className="rows-in space-y-3">
            {tickers.map((t, i) => {
              const total = t.buyCount + t.sellCount;
              return (
                <li key={t.ticker}>
                  <button
                    onClick={() => navigate(`/insiders/ticker/${encodeURIComponent(t.ticker)}`)}
                    className="group block w-full text-left"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="w-4 text-xs text-ink-600">{i + 1}</span>
                      <span className="font-mono text-sm font-semibold text-ink-50 group-hover:text-brand-300">{t.ticker}</span>
                      <span className="truncate text-[11px] text-ink-500">{t.sector ?? ''}</span>
                      <span className="ml-auto shrink-0 text-xs text-ink-400">{formatMoney(t.estimatedVolume)}</span>
                    </div>
                    <div className="mt-1.5 ml-6 flex h-1.5 bg-ink-800/80">
                      <div className="flex h-full" style={{ width: `${(total / maxTickerTrades) * 100}%` }}>
                        <div className="bar-grow h-full bg-up-500" style={{ width: `${(t.buyCount / Math.max(total, 1)) * 100}%` }} />
                        <div className="bar-grow h-full bg-down-500" style={{ width: `${(t.sellCount / Math.max(total, 1)) * 100}%` }} />
                      </div>
                    </div>
                    <div className="mt-1 ml-6 text-[11px] text-ink-500">
                      <span className="text-up-400">{t.buyCount} buys</span>
                      <span className="mx-1.5">·</span>
                      <span className="text-down-400">{t.sellCount} sells</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Most active members */}
        <div className="bg-ink-900/60 p-5">
          <ColumnTitle>Most active members</ColumnTitle>
          <ul className="rows-in space-y-3">
            {members.map((m) => (
              <li key={m.member}>
                <button
                  onClick={() => navigate(`/insiders/member/${encodeURIComponent(m.member)}`)}
                  className="group flex w-full items-center gap-3 text-left"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarClass(m.party)}`}>
                    {initials(m.member)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink-100 group-hover:text-brand-300">{m.member}</span>
                      <PartyBadge party={m.party} />
                    </span>
                    <span className="mt-1 flex h-1 bg-ink-800/80">
                      <span
                        className="bar-grow h-full bg-gradient-to-r from-brand-600 to-brand-400"
                        style={{ width: `${(m.estimatedVolume / maxMemberVolume) * 100}%` }}
                      />
                    </span>
                    <span className="mt-1 block text-[11px] text-ink-500">
                      {m.tradeCount} {m.tradeCount === 1 ? 'trade' : 'trades'} · {formatMoney(m.estimatedVolume)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
