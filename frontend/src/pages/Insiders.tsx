import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMembers, getSectors, getSectorWeekly, getSpotlight, getStatus } from '../api';
import type { SectorWeekly, SpotlightMember } from '../types';
import { SectorWeeklyStrip } from '../components/SectorWeeklyStrip';
import { SpotlightCards } from '../components/SpotlightCards';
import { DigestPanel } from '../components/DigestPanel';
import { SectionLabel } from '../components/ui';
import { InsidersHero } from '../components/Hero';

/** Overview: hero, weekly sector ring, latest filings and the spotlight. The full trade list lives on the Corporate tab. */
export function Insiders() {
  const [memberCount, setMemberCount] = useState(0);
  const [sectorCount, setSectorCount] = useState(0);
  const [totalTrades, setTotalTrades] = useState<number | null>(null);
  const [sectorWeekly, setSectorWeekly] = useState<SectorWeekly[]>([]);
  const [sectorWeeklyLoading, setSectorWeeklyLoading] = useState(true);
  const [spotlight, setSpotlight] = useState<SpotlightMember[]>([]);
  const [spotlightLoading, setSpotlightLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMembers(), getSectors()])
      .then(([m, s]) => {
        if (!cancelled) {
          setMemberCount(m.length);
          setSectorCount(s.length);
        }
      })
      .catch(() => {});
    getStatus()
      .then((s) => {
        if (!cancelled) setTotalTrades(s.totalTrades);
      })
      .catch(() => {});
    getSectorWeekly()
      .then((data) => {
        if (!cancelled) setSectorWeekly(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSectorWeeklyLoading(false);
      });
    getSpotlight()
      .then((data) => {
        if (!cancelled) setSpotlight(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSpotlightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="stagger space-y-10">
      <InsidersHero totalTrades={totalTrades} members={memberCount} sectors={sectorCount} />

      <SectorWeeklyStrip sectors={sectorWeekly} loading={sectorWeeklyLoading} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DigestPanel />
        </div>
        <section>
          <SectionLabel>Spotlight</SectionLabel>
          <SpotlightCards members={spotlight} loading={spotlightLoading} />
        </section>
      </div>

      <Link
        to="/trades"
        className="lift group flex items-center justify-between bg-gradient-to-r from-brand-700/30 to-ink-900/60 px-6 py-5"
      >
        <span>
          <span className="block text-sm font-semibold text-ink-50">Browse all {totalTrades ? totalTrades.toLocaleString() : ''} trades</span>
          <span className="block text-xs text-ink-400">
            Filter by member, sector, chamber, side, ticker or date, or switch to corporate insider trades.
          </span>
        </span>
        <span className="text-sm font-semibold text-brand-300 transition-transform group-hover:translate-x-1">Open</span>
      </Link>
    </div>
  );
}
