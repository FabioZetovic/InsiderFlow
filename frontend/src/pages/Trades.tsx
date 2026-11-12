import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { getCorporateInsiders } from '../api';
import type { InsiderTrade, PagedInsiders } from '../types';
import { Pagination } from '../components/Pagination';
import { Card, EmptyState, ErrorState, formatMoney, PageHeader, TableSkeleton } from '../components/ui';
import { AllTrades } from '../components/AllTrades';

function InsiderTypeBadge({ type }: { type: InsiderTrade['transactionType'] }) {
  const styles: Record<string, string> = {
    BUY: 'bg-up-500/15 text-up-400',
    SELL: 'bg-down-500/15 text-down-400',
    GRANT: 'bg-secondary-500/15 text-secondary-400',
    OTHER: 'bg-ink-500/15 text-ink-400',
  };
  return (
    <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold ${styles[type]}`}>
      {type}
    </span>
  );
}

/** SEC Form 4 table with its own ticker / side filters (kept in the URL). */
function CorporateTrades() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<PagedInsiders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const ticker = searchParams.get('ticker') ?? '';
  const type = searchParams.get('type') ?? '';
  const page = Number(searchParams.get('page') ?? '0');

  const setParam = (patch: Record<string, string>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (!('page' in patch)) next.delete('page');
      return next;
    });
  };

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getCorporateInsiders({ ticker: ticker || undefined, type: type || undefined, page, size: 50 })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [ticker, type, page]);
  useEffect(() => load(), [load]);

  return (
    <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            defaultValue={ticker}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setParam({ ticker: (e.target as HTMLInputElement).value.toUpperCase() });
            }}
            placeholder="Filter by ticker (Enter)"
            className="bg-ink-900/80 px-3 py-1.5 text-sm text-ink-200 focus:ring-1 focus:ring-brand-500/60 focus:outline-none"
          />
          <div className="flex gap-1">
            {['', 'BUY', 'SELL'].map((t) => (
              <button
                key={t || 'ALL'}
                onClick={() => setParam({ type: t })}
                className={`px-3 py-1.5 text-xs font-medium ${
                  type === t ? 'bg-brand-600 text-white' : 'bg-ink-800 text-ink-400'
                }`}
              >
                {t || 'All'}
              </button>
            ))}
          </div>
        </div>

      <Card>
        {loading && !data ? (
          <TableSkeleton rows={12} />
        ) : error ? (
          <ErrorState message="Failed to load corporate insider trades." onRetry={load} />
        ) : data && data.content.length > 0 ? (
          <>
            <div className={loading ? 'opacity-50' : ''}>
              <div className="overflow-x-auto">
                <table className="rows-in w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                      <th className="px-4 pt-4 pb-3 font-medium">Ticker</th>
                      <th className="px-4 pt-4 pb-3 font-medium">Insider</th>
                      <th className="px-4 pt-4 pb-3 font-medium">Type</th>
                      <th className="px-4 pt-4 pb-3 font-medium text-right">Shares</th>
                      <th className="px-4 pt-4 pb-3 font-medium text-right">Value</th>
                      <th className="px-4 pt-4 pb-3 font-medium">Date</th>
                      <th className="px-4 pt-4 pb-3 font-medium text-right">Filing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.map((t) => (
                      <tr key={t.id} className="even:bg-ink-950/30 transition-colors hover:bg-brand-500/[0.06]">
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => navigate(`/insiders/ticker/${encodeURIComponent(t.ticker)}`)}
                            className="font-mono font-semibold text-ink-100 hover:text-brand-400"
                          >
                            {t.ticker}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="block text-ink-200">{t.insiderName}</span>
                          {t.insiderTitle && <span className="block text-xs text-ink-500">{t.insiderTitle}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <InsiderTypeBadge type={t.transactionType} />
                        </td>
                        <td className="px-4 py-2.5 text-right text-ink-300">
                          {t.shares != null ? t.shares.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-ink-300">{formatMoney(t.value)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-ink-400">
                          {format(parseISO(t.transactionDate), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <a
                            href={t.filingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-ink-500 hover:text-brand-400"
                            title="SEC filing"
                          >
                            Filing
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              onPageChange={(p) => setParam({ page: String(p) })}
            />
          </>
        ) : (
          <EmptyState message="No corporate insider trades yet. The SEC Form 4 ingest may still be running." />
        )}
      </Card>
    </section>
  );
}

type View = 'all' | 'corporate';

const VIEWS: { id: View; label: string; title: string; description: string }[] = [
  {
    id: 'all',
    label: 'All trades',
    title: 'All Trades',
    description:
      'Every stock trade disclosed by members of Congress and the President. Filter by member, sector, chamber, side, ticker or date.',
  },
  {
    id: 'corporate',
    label: 'Corporate trades',
    title: 'Corporate Insiders',
    description:
      'SEC Form 4 filings: company officers, directors, and 10% owners trading their own stock. Limited to companies Congress also trades, so you can compare both.',
  },
];

export function Trades() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get('view') === 'corporate' ? 'corporate' : 'all';
  const current = VIEWS.find((v) => v.id === view)!;

  // Each view has its own filters, so switching starts from a clean URL.
  const switchTo = (next: View) => {
    if (next !== view) setSearchParams(next === 'all' ? {} : { view: next });
  };

  return (
    <div className="stagger space-y-8">
      <PageHeader title={current.title} description={current.description}>
        <div role="tablist" aria-label="Trade source" className="relative flex bg-ink-900/80 p-1">
          <span
            aria-hidden
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-brand-600 transition-transform duration-300 ease-out"
            style={{ transform: view === 'corporate' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => switchTo(v.id)}
              className={`relative z-10 w-40 px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
                view === v.id ? 'text-white' : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div key={view} className="animate-rise">
        {view === 'all' ? <AllTrades /> : <CorporateTrades />}
      </div>
    </div>
  );
}
