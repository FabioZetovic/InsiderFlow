import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Newspaper } from 'lucide-react';
import { getDigest } from '../api';
import type { Digest } from '../types';
import { Card, formatMoney, PartyBadge, Skeleton, TypeBadge } from './ui';

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
    return <Skeleton className="h-40 w-full" />;
  }
  if (!digest || digest.newTrades === 0) {
    return null;
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Newspaper className="h-4 w-4 text-emerald-400" />
          Latest filings
          {digest.since && (
            <span className="font-normal text-zinc-500">since {format(parseISO(digest.since), 'MMM d')}</span>
          )}
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-300">{digest.newTrades.toLocaleString()} trades</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {digest.newBuys}
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <ArrowDownRight className="h-3.5 w-3.5" />
            {digest.newSells}
          </span>
          <span className="text-zinc-400">≈{formatMoney(digest.estimatedVolume)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-zinc-800 lg:grid-cols-3">
        {/* Notable trades */}
        <div className="bg-zinc-900/50 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Biggest trades</h3>
          <ul className="space-y-2">
            {digest.notableTrades.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <TypeBadge type={t.transactionType} />
                {t.ticker ? (
                  <button
                    onClick={() => navigate(`/insiders/ticker/${encodeURIComponent(t.ticker!)}`)}
                    className="font-mono font-semibold text-zinc-100 hover:text-emerald-400"
                  >
                    {t.ticker}
                  </button>
                ) : (
                  <span className="truncate text-xs text-zinc-400">{t.assetDescription}</span>
                )}
                <span className="ml-auto text-xs text-zinc-500">{t.amountRange}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Top tickers */}
        <div className="bg-zinc-900/50 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Most traded tickers</h3>
          <ul className="space-y-2">
            {digest.topTickers.slice(0, 5).map((t) => (
              <li key={t.ticker} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => navigate(`/insiders/ticker/${encodeURIComponent(t.ticker)}`)}
                  className="font-mono font-semibold text-zinc-100 hover:text-emerald-400"
                >
                  {t.ticker}
                </button>
                <span className="text-xs text-emerald-400">{t.buyCount}B</span>
                <span className="text-xs text-red-400">{t.sellCount}S</span>
                <span className="ml-auto text-xs text-zinc-500">{formatMoney(t.estimatedVolume)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Top members */}
        <div className="bg-zinc-900/50 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Most active members</h3>
          <ul className="space-y-2">
            {digest.topMembers.slice(0, 5).map((m) => (
              <li key={m.member} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => navigate(`/insiders/member/${encodeURIComponent(m.member)}`)}
                  className="truncate text-zinc-200 hover:text-emerald-400"
                >
                  {m.member}
                </button>
                <PartyBadge party={m.party} />
                <span className="ml-auto text-xs text-zinc-500">
                  {m.tradeCount} · {formatMoney(m.estimatedVolume)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
