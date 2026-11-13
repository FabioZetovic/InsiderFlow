import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../auth/AuthContext';
import { getStatus } from '../api';
import type { AppStatus } from '../types';
import { Logo } from './Logo';
import { TradeDrawer } from './TradeDrawer';

const NAV = [
  { to: '/insiders', label: 'Insiders' },
  { to: '/trades', label: 'Trades' },
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

/** Appears after scrolling down a screen; smooth-scrolls back to the top. */
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed right-6 bottom-6 z-30 bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-black/40 transition-all duration-300 hover:bg-brand-500 ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      Back to top
    </button>
  );
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

      <footer className="mt-12 bg-ink-950/70 px-4 pt-10 pb-6">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-3 text-sm leading-relaxed text-ink-400">
                Public stock-trading disclosures from Congress, the President and corporate insiders,
                in one place.
              </p>
            </div>
            <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
              {NAV.map((item) => (
                <Link key={item.to} to={item.to} className="text-ink-400 transition-colors hover:text-brand-300">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="text-sm text-ink-400">
              <div className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Sources</div>
              <ul className="mt-2 space-y-1">
                <li>House and Senate STOCK Act filings</li>
                <li>OGE Form 278-T</li>
                <li>SEC Form 4 (EDGAR)</li>
                <li>Finnhub, Yahoo Finance</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-600 sm:pr-36">
            <span>
              {status
                ? `${status.totalTrades.toLocaleString()} trades · last ingest ${formatInstant(status.lastIngestAt)} · senate scraper ${
                    senateScraper?.updatedAt ? formatInstant(senateScraper.updatedAt) : 'not run'
                  }`
                : 'InsiderFlow'}
            </span>
            <span>Not investment advice. Disclosures can lag trades by up to 45 days.</span>
          </div>
        </div>
      </footer>

      <BackToTop />
      <TradeDrawer />
    </div>
  );
}
