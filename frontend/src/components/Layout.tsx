import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../auth/AuthContext';
import { getStatus } from '../api';
import type { AppStatus } from '../types';
import { Logo } from './Logo';

const NAV = [
  { to: '/insiders', label: 'Insiders' },
  { to: '/corporate', label: 'Corporate' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/signals', label: 'Signals' },
  { to: '/compare', label: 'Compare' },
  { to: '/feed', label: 'Feed' },
  { to: '/market', label: 'Market' },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `relative z-10 whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-colors duration-300 ${
    isActive ? 'text-ink-50' : 'text-ink-400 hover:text-ink-100'
  }`;

function formatInstant(value: string | null): string {
  if (!value) return 'never';
  try {
    return format(parseISO(value), 'MMM d, HH:mm');
  } catch {
    return value;
  }
}

/** Sliding pill behind the active nav item. */
function useNavIndicator(pathname: string) {
  const navRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const active = navRef.current?.querySelector<HTMLAnchorElement>('a.active');
      setBox(active ? { left: active.offsetLeft, width: active.offsetWidth } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pathname]);
  return { navRef, box };
}

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<AppStatus | null>(null);
  const { navRef, box } = useNavIndicator(location.pathname);

  useEffect(() => {
    let cancelled = false;
    getStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        /* footer just stays quiet if status is unavailable */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const senateScraper = status?.sources.find((s) => s.source === 'SENATE_SCRAPER');

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-ink-950/75 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-8">
            <Link to="/insiders" className="shrink-0">
              <Logo />
            </Link>
            <nav ref={navRef} className="no-scrollbar relative flex items-center overflow-x-auto">
              {box && (
                <span
                  aria-hidden
                  className="absolute top-1/2 h-8 -translate-y-1/2 bg-brand-500/15 transition-all duration-300 ease-out"
                  style={{ left: box.left, width: box.width }}
                />
              )}
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} className={tabClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-sm text-ink-400">
            <span className="hidden sm:inline">{user?.username}</span>
            <button onClick={logout} className="font-medium transition-colors hover:text-ink-100">
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Data pipeline warnings — silence must not look like success */}
      {status?.senateStale && (
        <div className="animate-fade bg-accent-500/10 px-4 py-2 text-center text-xs text-accent-300">
          Senate data may be stale. The eFD scraper hasn't run in over 3 days. Run{' '}
          <code className="bg-ink-900 px-1">node scripts/senate-efd-scraper.js</code> to refresh.
        </div>
      )}
      {status?.newTrumpFilingDetected && (
        <div className="animate-fade bg-secondary-500/10 px-4 py-2 text-center text-xs text-secondary-300">
          A new presidential 278-T filing dated {status.newTrumpFilingDate} was detected on OGE.
          Trump's trades here may be incomplete until the dataset updates.
        </div>
      )}

      <main key={location.pathname} className="animate-rise flex-1 max-w-screen-2xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-ink-950/60 px-4 py-4">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <span>
            {status
              ? `${status.totalTrades.toLocaleString()} trades · last ingest ${formatInstant(status.lastIngestAt)} · senate scraper ${
                  senateScraper?.updatedAt ? formatInstant(senateScraper.updatedAt) : 'not run'
                }`
              : 'InsiderFlow'}
          </span>
          <span>Data: House/Senate STOCK Act filings, OGE 278-T, Finnhub, Yahoo Finance</span>
        </div>
      </footer>
    </div>
  );
}
