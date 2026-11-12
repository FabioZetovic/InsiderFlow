import { useState } from 'react';
import { useWatchlist } from '../watchlist/WatchlistContext';

/** Follow / Following toggle for a member or ticker. */
export function WatchButton({
  type,
  value,
  size = 'md',
}: {
  type: 'member' | 'ticker';
  value: string;
  size?: 'sm' | 'md';
}) {
  const { isWatched, toggle } = useWatchlist();
  const [busy, setBusy] = useState(false);
  const watched = isWatched(type, value);
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs';

  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        e.preventDefault();
        setBusy(true);
        try {
          await toggle(type, value);
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      title={watched ? 'Unfollow' : 'Follow'}
      className={`${pad} font-sans font-semibold tracking-normal ${
        watched
          ? 'bg-brand-500/20 text-brand-300 hover:bg-down-500/15 hover:text-down-300'
          : 'bg-ink-800/80 text-ink-300 hover:bg-brand-600 hover:text-white'
      } ${busy ? 'opacity-50' : ''}`}
    >
      {watched ? 'Following' : 'Follow'}
    </button>
  );
}
