import { useState } from 'react';
import { Star } from 'lucide-react';
import { useWatchlist } from '../watchlist/WatchlistContext';

/** Star toggle to follow/unfollow a member or ticker. */
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
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

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
      className={`transition-colors ${
        watched ? 'text-accent-400 hover:text-accent-300' : 'text-ink-600 hover:text-ink-300'
      } ${busy ? 'opacity-50' : ''}`}
    >
      <Star className={iconClass} fill={watched ? 'currentColor' : 'none'} />
    </button>
  );
}
