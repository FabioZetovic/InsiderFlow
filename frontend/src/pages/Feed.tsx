import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { getFeed, getWatchlist } from '../api';
import type { PagedResponse, Trade, WatchlistDto } from '../types';
import { TradeTable } from '../components/TradeTable';
import { Pagination } from '../components/Pagination';
import { Card, EmptyState, ErrorState, TableSkeleton } from '../components/ui';

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
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-100">
          <Star className="h-6 w-6 text-accent-400" fill="currentColor" />
          My Feed
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Trades by members and on tickers you follow. Star any member or ticker to add them here.
        </p>
      </div>

      {watchlist && !isEmpty && (
        <Card>
          <div className="flex flex-wrap gap-4 px-4 py-3 text-sm">
            {watchlist.members.length > 0 && (
              <div>
                <span className="text-xs uppercase tracking-wider text-ink-500">Members</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {watchlist.members.map((m) => (
                    <Link
                      key={m}
                      to={`/insiders/member/${encodeURIComponent(m)}`}
                      className="rounded bg-ink-800 px-2 py-0.5 text-xs text-ink-300 hover:text-brand-400"
                    >
                      {m}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {watchlist.tickers.length > 0 && (
              <div>
                <span className="text-xs uppercase tracking-wider text-ink-500">Tickers</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {watchlist.tickers.map((t) => (
                    <Link
                      key={t}
                      to={`/insiders/ticker/${encodeURIComponent(t)}`}
                      className="rounded bg-ink-800 px-2 py-0.5 font-mono text-xs text-ink-300 hover:text-brand-400"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card>
        {loading && !feed ? (
          <TableSkeleton rows={10} />
        ) : error ? (
          <ErrorState message="Failed to load your feed." onRetry={load} />
        ) : isEmpty ? (
          <EmptyState message="Your watchlist is empty. Open any member or ticker page and click the ☆ to follow them." />
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
  );
}
