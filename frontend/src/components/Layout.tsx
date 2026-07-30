import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Activity, AlertTriangle, Building2, GitCompare, LandPlot, LogOut, Radar, Star, TrendingUp, Trophy } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getStatus } from '../api';
import type { AppStatus } from '../types';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
    isActive ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
  }`;

function formatInstant(value: string | null): string {
  if (!value) return 'never';
  try {
    return format(parseISO(value), 'MMM d, HH:mm');
  } catch {
    return value;
  }
}

export function Layout() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<AppStatus | null>(null);

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
      <header className="border-b border-zinc-800 bg-zinc-950/95 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <span className="font-bold text-zinc-100 tracking-tight">
                Insider<span className="text-emerald-400">Flow</span>
              </span>
            </div>
            <nav className="flex items-center gap-0.5">
              <NavLink to="/insiders" className={tabClass}>
                <LandPlot className="w-4 h-4" />
                <span className="hidden lg:inline">Insiders</span>
              </NavLink>
              <NavLink to="/corporate" className={tabClass}>
                <Building2 className="w-4 h-4" />
                <span className="hidden lg:inline">Corporate</span>
              </NavLink>
              <NavLink to="/leaderboard" className={tabClass}>
                <Trophy className="w-4 h-4" />
                <span className="hidden lg:inline">Leaderboard</span>
              </NavLink>
              <NavLink to="/signals" className={tabClass}>
                <Radar className="w-4 h-4" />
                <span className="hidden lg:inline">Signals</span>
              </NavLink>
              <NavLink to="/compare" className={tabClass}>
                <GitCompare className="w-4 h-4" />
                <span className="hidden lg:inline">Compare</span>
              </NavLink>
              <NavLink to="/feed" className={tabClass}>
                <Star className="w-4 h-4" />
                <span className="hidden lg:inline">Feed</span>
              </NavLink>
              <NavLink to="/market" className={tabClass}>
                <Activity className="w-4 h-4" />
                <span className="hidden lg:inline">Market</span>
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span className="hidden sm:inline">{user?.username}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Data pipeline warnings — silence must not look like success */}
      {status?.senateStale && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-400">
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          Senate data may be stale — the eFD scraper hasn't run in over 3 days. Run{' '}
          <code className="rounded bg-zinc-900 px-1">node scripts/senate-efd-scraper.js</code> to refresh.
        </div>
      )}
      {status?.newTrumpFilingDetected && (
        <div className="border-b border-sky-500/30 bg-sky-500/10 px-4 py-2 text-center text-xs text-sky-400">
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          A new presidential 278-T filing dated {status.newTrumpFilingDate} was detected on OGE —
          Trump's trades here may be incomplete until the dataset updates.
        </div>
      )}

      <main className="flex-1 max-w-screen-2xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-800/60 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
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
