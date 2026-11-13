import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getHotTickers, getMembers, getSectors, getTrades } from '../api';
import type { Chamber, HotTicker, MemberStats, PagedResponse, SectorStats, Trade, TransactionType } from '../types';
import { FilterBar } from './FilterBar';
import { TradeTable } from './TradeTable';
import { Pagination } from './Pagination';
import { Card, CountUp, ErrorState, TableSkeleton } from './ui';

/**
 * Every congressional and presidential trade: filter bar, sortable table, pagination.
 * Filters live in the URL so a filtered view can be shared or bookmarked.
 */
export function AllTrades() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trades, setTrades] = useState<PagedResponse<Trade> | null>(null);
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [sectors, setSectors] = useState<SectorStats[]>([]);
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
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in patch)) next.delete('page');
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
        /* filter metadata is non-critical; the table shows its own error */
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
    // Previous rows stay visible (dimmed) while the next page/filter loads.
    setLoading(true);
    setError(null);
    getTrades({ member, sector, chamber, type, search, from, to, sort, page, size: 50 })
      .then((data) => {
        if (!cancelled) setTrades(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load trades. Please try again in a moment.');
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
    <section>
      <div className="mb-px">
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
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-ink-50">
              {trades ? <CountUp value={trades.totalElements} duration={700} /> : '—'}
            </span>
            <span className="text-sm text-ink-400">matching trades</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-[3px] bg-up-500" />Buy</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-[3px] bg-down-500" />Sell</span>
            <span><span className="mr-1 bg-accent-500/15 px-1 font-semibold text-accent-300">HOT</span>heavily traded lately</span>
            <span><span className="mr-1 bg-accent-500/15 px-1 font-semibold text-accent-300">LATE</span>filed after 45 days</span>
            <span><span className="mr-1 bg-brand-500/15 px-1 font-semibold text-brand-300">COMMITTEE</span>oversees the sector</span>
            <span><span className="mr-1 bg-secondary-500/15 px-1 font-semibold text-secondary-300">EARNINGS</span>just before a report</span>
          </div>
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
  );
}
