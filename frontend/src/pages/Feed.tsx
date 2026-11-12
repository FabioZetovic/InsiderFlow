import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeed, getWatchlist } from '../api';
import type { PagedResponse, Trade, WatchlistDto } from '../types';
import { TradeTable } from '../components/TradeTable';
import { Pagination } from '../components/Pagination';
import { Card, EmptyState, ErrorState, PageHeader, SectionLabel, TableSkeleton } from '../components/ui';

export function Feed() {
  const [feed, setFeed] = useState<PagedResponse<Trade> | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistDto | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([getFeed(page, 50), getWatchlist()])
      .then(([f, w]) => {
        setFeed(f);
        setWatchlist(w);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [page]);
  useEffect(() => load(), [load]);

  const isEmpty = watchlist && watchlist.members.length === 0 && watchlist.tickers.length === 0;

  return (
    <div className="stagger space-y-8">
      <PageHeader
        title="My Feed"
        description="Trades by members and on tickers you follow. Use Follow on any member or ticker page to add them here."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <aside className="space-y-6">
          <div>
            <SectionLabel>Following members</SectionLabel>
            {watchlist && watchlist.members.length > 0 ? (
              <ul className="rows-in space-y-1">
                {watchlist.members.map((m) => (
                  <li key={m}>
                    <Link
                      to={`/insiders/member/${encodeURIComponent(m)}`}
                      className="block bg-ink-900/60 px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-ink-800/80 hover:text-brand-300"
                    >
                      {m}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-500">None yet.</p>
            )}
          </div>
          <div>
            <SectionLabel>Following tickers</SectionLabel>
            {watchlist && watchlist.tickers.length > 0 ? (
              <ul className="rows-in flex flex-wrap gap-1.5">
                {watchlist.tickers.map((t) => (
                  <li key={t}>
                    <Link
                      to={`/insiders/ticker/${encodeURIComponent(t)}`}
                      className="block bg-ink-900/60 px-2.5 py-1.5 font-mono text-xs text-ink-200 transition-colors hover:bg-ink-800/80 hover:text-brand-300"
                    >
                      {t}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-500">None yet.</p>
            )}
          </div>
        </aside>

        <Card className="xl:col-span-3">
          {loading && !feed ? (
            <TableSkeleton rows={10} />
          ) : error ? (
            <ErrorState message="Failed to load your feed." onRetry={load} />
          ) : isEmpty ? (
            <EmptyState message="Your watchlist is empty. Open any member or ticker page and click Follow to add them." />
          ) : feed && feed.content.length > 0 ? (
            <>
              <TradeTable trades={feed.content} refreshing={loading} />
              <Pagination
                page={feed.page}
                totalPages={feed.totalPages}
                totalElements={feed.totalElements}
                onPageChange={setPage}
              />
            </>
          ) : (
            <EmptyState message="No trades yet from anyone on your watchlist." />
          )}
        </Card>
      </div>
    </div>
  );
}
