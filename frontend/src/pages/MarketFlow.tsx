import { useCallback, useEffect, useState } from 'react';
import { addDays, format } from 'date-fns';
import { getEarnings, getMarketEvents, getSectorFlow, getSpx } from '../api';
import type { EarningsEvent, MarketEvent, SectorFlow, SpxResponse } from '../types';
import { SectorHeatmap } from '../components/SectorHeatmap';
import { SpxStrip } from '../components/SpxStrip';
import { EventsList } from '../components/EventsList';
import { EarningsList } from '../components/EarningsList';
import { Card, ErrorState, PageHeader, Skeleton } from '../components/ui';

interface Loadable<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useLoadable<T>(fetcher: () => Promise<T>): [Loadable<T>, () => void] {
  const [state, setState] = useState<Loadable<T>>({ data: null, loading: true, error: null });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => setState({ data, loading: false, error: null }))
      .catch(() => setState({ data: null, loading: false, error: 'Failed to load.' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return [state, load];
}

export function MarketFlow() {
  const [flows, reloadFlows] = useLoadable<SectorFlow[]>(() => getSectorFlow());
  const [events, reloadEvents] = useLoadable<MarketEvent[]>(() =>
    getMarketEvents(format(new Date(), 'yyyy-MM-dd'), format(addDays(new Date(), 60), 'yyyy-MM-dd')),
  );
  const [spx, reloadSpx] = useLoadable<SpxResponse>(() => getSpx());
  const [earnings, reloadEarnings] = useLoadable<EarningsEvent[]>(() => getEarnings());

  return (
    <div className="stagger space-y-8">
      <PageHeader
        title="Market Flow"
        description="Daily sector ETF moves, the S&P 500, upcoming macro events and this week's earnings."
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <Card title="Sector flow, SPDR sector ETFs (daily % change)" className="xl:col-span-2">
          {flows.loading ? (
            <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 11 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : flows.error ? (
            <ErrorState message="Sector flow unavailable." onRetry={reloadFlows} />
          ) : flows.data && flows.data.length > 0 ? (
            <SectorHeatmap flows={flows.data} />
          ) : (
            <ErrorState
              message="No sector data cached yet. Quotes refresh every 15 minutes during US market hours."
              onRetry={reloadFlows}
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card title="S&P 500">
            {spx.loading ? (
              <div className="p-5">
                <Skeleton className="h-16" />
              </div>
            ) : spx.error || !spx.data ? (
              <ErrorState message="S&P 500 quote unavailable." onRetry={reloadSpx} />
            ) : (
              <SpxStrip spx={spx.data} />
            )}
          </Card>

          <Card title="Upcoming market events">
            {events.loading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : events.error ? (
              <ErrorState message="Events unavailable." onRetry={reloadEvents} />
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <EventsList events={events.data ?? []} />
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title="Earnings this week">
        {earnings.loading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : earnings.error ? (
          <ErrorState message="Earnings unavailable." onRetry={reloadEarnings} />
        ) : (
          <EarningsList earnings={earnings.data ?? []} />
        )}
      </Card>
    </div>
  );
}
