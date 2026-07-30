import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getWatchlist, toggleWatch } from '../api';

interface WatchlistContextValue {
  members: Set<string>;
  tickers: Set<string>;
  isWatched: (type: 'member' | 'ticker', value: string) => boolean;
  toggle: (type: 'member' | 'ticker', value: string) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue | undefined>(undefined);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [tickers, setTickers] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getWatchlist()
      .then((w) => {
        if (!cancelled) {
          setMembers(new Set(w.members));
          setTickers(new Set(w.tickers));
        }
      })
      .catch(() => {
        /* not logged in yet, or no watchlist — start empty */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async (type: 'member' | 'ticker', value: string) => {
    const updated = await toggleWatch(type, value);
    setMembers(new Set(updated.members));
    setTickers(new Set(updated.tickers));
  }, []);

  const isWatched = useCallback(
    (type: 'member' | 'ticker', value: string) =>
      type === 'ticker' ? tickers.has(value.toUpperCase()) : members.has(value),
    [members, tickers],
  );

  const value = useMemo(
    () => ({ members, tickers, isWatched, toggle }),
    [members, tickers, isWatched, toggle],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) {
    throw new Error('useWatchlist must be used within WatchlistProvider');
  }
  return ctx;
}
