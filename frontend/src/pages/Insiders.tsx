import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHotTickers, getMembers, getSectors, getSectorWeekly, getSpotlight, getTrades } from '../api';
import type {
  Chamber,
  HotTicker,
  MemberStats,
  PagedResponse,
  SectorStats,
  SectorWeekly,
  SpotlightMember,
  Trade,
  TransactionType,
} from '../types';
import { FilterBar } from '../components/FilterBar';
import { TradeTable } from '../components/TradeTable';
import { Pagination } from '../components/Pagination';
import { SectorWeeklyStrip } from '../components/SectorWeeklyStrip';
import { SpotlightCards } from '../components/SpotlightCards';
import { DigestPanel } from '../components/DigestPanel';
import { Card, ErrorState, TableSkeleton } from '../components/ui';

export function Insiders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trades, setTrades] = useState<PagedResponse<Trade> | null>(null);
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [sectors, setSectors] = useState<SectorStats[]>([]);
  const [sectorWeekly, setSectorWeekly] = useState<SectorWeekly[]>([]);
  const [sectorWeeklyLoading, setSectorWeeklyLoading] = useState(true);
  const [spotlight, setSpotlight] = useState<SpotlightMember[]>([]);
  const [spotlightLoading, setSpotlightLoading] = useState(true);
  const [hotTickers, setHotTickers] = useState<HotTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const member = searchParams.get('member') ?? '';
  const sector = searchParams.get('sector') ?? '';
  const chamber = (searchParams.get('chamber') ?? '') as Chamber | '';
  const type = (searchParams.get('type') ?? '') as TransactionType | '';
  const search = searchParams.get('search') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const sort = searchParams.get('sort') ?? '';
  const page = Number(searchParams.get('page') ?? '0');

  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
        }
        if (!('page' in patch)) {
          next.delete('page');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMembers(), getSectors()])
      .then(([m, s]) => {
        if (!cancelled) {
          setMembers(m);
          setSectors(s);
        }
      })
      .catch(() => {
        /* filter metadata is non-critical; table shows its own error */
      });
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
    getHotTickers()
      .then((data) => {
        if (!cancelled) setHotTickers(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTrades = useCallback(() => {
    let cancelled = false;
    // Keep the previous rows visible (dimmed) while the next page/filter loads —
    // only the very first load shows skeletons.
    setLoading(true);
    setError(null);
    getTrades({ member, sector, chamber, type, search, from, to, sort, page, size: 50 })
      .then((data) => {
        if (!cancelled) setTrades(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load trades. Check that the backend is running and ingestion has completed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [member, sector, chamber, type, search, from, to, sort, page]);

  useEffect(() => loadTrades(), [loadTrades]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-100">Insiders</h1>
        <p className="mt-1 text-sm text-ink-500">
          Stock trades disclosed by members of Congress and the President, updated daily.
        </p>
      </div>

      <SectorWeeklyStrip sectors={sectorWeekly} loading={sectorWeeklyLoading} />

      <DigestPanel />

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Spotlight</h2>
        <SpotlightCards members={spotlight} loading={spotlightLoading} />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">All trades</h2>
        <Card>
          <div className="border-b border-ink-800 px-4 py-3">
            <FilterBar
              members={members}
              sectors={sectors}
              member={member}
              sector={sector}
              chamber={chamber}
              type={type}
              search={search}
              from={from}
              to={to}
              onChange={(patch) => updateParams(patch as Record<string, string>)}
            />
          </div>
          {error ? (
            <ErrorState message={error} onRetry={loadTrades} />
          ) : trades ? (
            <>
              <TradeTable
                trades={trades.content}
                hotTickers={hotTickers}
                sort={sort || undefined}
                onSortChange={(s) => updateParams({ sort: s })}
                refreshing={loading}
              />
              <Pagination
                page={trades.page}
                totalPages={trades.totalPages}
                totalElements={trades.totalElements}
                onPageChange={(p) => updateParams({ page: String(p) })}
              />
            </>
          ) : (
            <TableSkeleton rows={12} />
          )}
        </Card>
      </section>
    </div>
  );
}
