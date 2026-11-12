import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { getDigest } from '../api';
import type { Digest } from '../types';
import { formatMoney, PartyBadge, Skeleton, TypeBadge } from './ui';

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
    return <Skeleton className="h-56 w-full" />;
  }
  if (!digest || digest.newTrades === 0) {
    return null;
  }

  return (
    <section className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-400">
          Latest filings
          {digest.since && (
            <span className="ml-2 font-normal normal-case tracking-normal text-ink-500">
              since {format(parseISO(digest.since), 'MMM d')}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-ink-300">{digest.newTrades.toLocaleString()} trades</span>
          <span className="text-up-400">{digest.newBuys} buys</span>
          <span className="text-down-400">{digest.newSells} sells</span>
          <span className="text-ink-400">≈{formatMoney(digest.estimatedVolume)}</span>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-px md:grid-cols-3">
        <div className="bg-ink-900/60 p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">Biggest trades</h3>
          <ul className="rows-in space-y-2.5">
            {digest.notableTrades.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <TypeBadge type={t.transactionType} />
                {t.ticker ? (
                  <button
                    onClick={() => navigate(`/insiders/ticker/${encodeURIComponent(t.ticker!)}`)}
                    className="font-mono font-semibold text-ink-100 hover:text-brand-400"
                  >
                    {t.ticker}
                  </button>
                ) : (
                  <span className="truncate text-xs text-ink-400">{t.assetDescription}</span>
                )}
                <span className="ml-auto text-xs text-ink-500">{t.amountRange}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-ink-900/60 p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">Most traded tickers</h3>
          <ul className="rows-in space-y-2.5">
            {digest.topTickers.slice(0, 5).map((t) => (
              <li key={t.ticker} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => navigate(`/insiders/ticker/${encodeURIComponent(t.ticker)}`)}
                  className="font-mono font-semibold text-ink-100 hover:text-brand-400"
                >
                  {t.ticker}
                </button>
                <span className="text-xs text-up-400">{t.buyCount}B</span>
                <span className="text-xs text-down-400">{t.sellCount}S</span>
                <span className="ml-auto text-xs text-ink-500">{formatMoney(t.estimatedVolume)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-ink-900/60 p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">Most active members</h3>
          <ul className="rows-in space-y-2.5">
            {digest.topMembers.slice(0, 5).map((m) => (
              <li key={m.member} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => navigate(`/insiders/member/${encodeURIComponent(m.member)}`)}
                  className="truncate text-ink-200 hover:text-brand-400"
                >
                  {m.member}
                </button>
                <PartyBadge party={m.party} />
                <span className="ml-auto shrink-0 text-xs text-ink-500">
                  {m.tradeCount} · {formatMoney(m.estimatedVolume)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
