import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { getCorporateInsiders } from '../api';
import type { InsiderTrade, PagedInsiders } from '../types';
import { Pagination } from '../components/Pagination';
import { Avatar, Card, CountUp, EmptyState, ErrorState, FieldLabel, formatMoney, PageHeader, SearchField, Segmented, TableSkeleton } from '../components/ui';
import { AllTrades } from '../components/AllTrades';

type InsiderSide = 'BUY' | 'SELL' | 'GRANT';

const SIDE_STYLE: Record<string, { pill: string; stripe: string }> = {
  BUY: { pill: 'bg-up-500/15 text-up-400', stripe: 'bg-up-500' },
  SELL: { pill: 'bg-down-500/15 text-down-400', stripe: 'bg-down-500' },
  GRANT: { pill: 'bg-secondary-500/15 text-secondary-300', stripe: 'bg-secondary-500' },
  OTHER: { pill: 'bg-ink-500/15 text-ink-300', stripe: 'bg-ink-600' },
};

function Roles({ t }: { t: InsiderTrade }) {
  const roles = [t.officer && 'Officer', t.director && 'Director', t.tenPercentOwner && '10% owner'].filter(Boolean) as string[];
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {roles.map((r) => (
        <span key={r} className="bg-ink-800/90 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          {r}
        </span>
      ))}
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
  const type = (searchParams.get('type') ?? '') as InsiderSide | '';
  const page = Number(searchParams.get('page') ?? '0');
  const [tickerDraft, setTickerDraft] = useState(ticker);

  const setParam = useCallback(
    (patch: Record<string, string>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  // Debounced ticker filter.
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = tickerDraft.trim().toUpperCase();
      if (next !== ticker) setParam({ ticker: next });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerDraft]);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getCorporateInsiders({ ticker: ticker || undefined, type: type || undefined, page, size: 50 })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [ticker, type, page]);
  useEffect(() => load(), [load]);

  const rows = data?.content ?? [];
  const maxValue = Math.max(1, ...rows.map((r) => r.value ?? 0));

  return (
    <section>
      <div className="mb-px bg-ink-900/60 p-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="w-full sm:w-80">
            <FieldLabel>Company ticker</FieldLabel>
            <SearchField value={tickerDraft} onChange={setTickerDraft} placeholder="e.g. NVDA, MSFT, JPM" />
          </div>
          <div>
            <FieldLabel>Transaction</FieldLabel>
            <Segmented<InsiderSide>
              options={[
                { label: 'All', value: '' },
                { label: 'Buys', value: 'BUY' },
                { label: 'Sells', value: 'SELL' },
                { label: 'Grants', value: 'GRANT' },
              ]}
              value={type}
              onChange={(v) => setParam({ type: v })}
            />
          </div>
          {(ticker || type) && (
            <button
              onClick={() => {
                setTickerDraft('');
                setParam({ ticker: '', type: '' });
              }}
              className="ml-auto px-2 py-1 text-xs font-semibold text-ink-400 hover:text-ink-100"
            >
              Reset all
            </button>
          )}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline gap-2 px-6 pt-5">
          <span className="text-2xl font-bold text-ink-50">{data ? <CountUp value={data.totalElements} duration={700} /> : '—'}</span>
          <span className="text-sm text-ink-400">insider transactions{ticker ? ` in ${ticker}` : ''}</span>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={12} />
        ) : error ? (
          <ErrorState message="Failed to load corporate insider trades." onRetry={load} />
        ) : rows.length > 0 ? (
          <>
            <div className={`overflow-x-auto transition-opacity duration-300 ${loading ? 'opacity-50' : ''}`}>
              <table className="rows-in w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                    <th className="px-4 pt-5 pb-3 pl-6">Insider</th>
                    <th className="px-4 pt-5 pb-3">Company</th>
                    <th className="px-4 pt-5 pb-3">Side</th>
                    <th className="px-4 pt-5 pb-3 text-right">Shares</th>
                    <th className="px-4 pt-5 pb-3">Value</th>
                    <th className="px-4 pt-5 pb-3">Date</th>
                    <th className="px-4 pt-5 pb-3 pr-6" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const side = SIDE_STYLE[t.transactionType] ?? SIDE_STYLE.OTHER;
                    return (
                      <tr key={t.id} className="group transition-colors hover:bg-brand-500/[0.06]">
                        <td className="relative py-3 pr-4 pl-6">
                          <span className={`absolute inset-y-2 left-0 w-[3px] ${side.stripe}`} />
                          <div className="flex items-center gap-3">
                            <Avatar name={t.insiderName} size="sm" tint="bg-secondary-500/15 text-secondary-300" />
                            <div className="min-w-0">
                              <span className="block truncate font-medium text-ink-100">{t.insiderName}</span>
                              {t.insiderTitle && <span className="block max-w-64 truncate text-[11px] text-ink-500">{t.insiderTitle}</span>}
                              <Roles t={t} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/insiders/ticker/${encodeURIComponent(t.ticker)}`)}
                            className="bg-ink-800/80 px-2 py-0.5 font-mono text-[13px] font-semibold text-ink-50 transition-colors hover:bg-brand-500/20 hover:text-brand-200"
                          >
                            {t.ticker}
                          </button>
                          {t.issuerName && <span className="mt-1 block max-w-56 truncate text-xs text-ink-500">{t.issuerName}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold ${side.pill}`}>{t.transactionType}</span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="font-medium text-ink-100">{t.shares != null ? t.shares.toLocaleString() : '—'}</span>
                          {t.pricePerShare != null && t.pricePerShare > 0 && (
                            <span className="block text-[11px] text-ink-500">at ${t.pricePerShare.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="w-48 px-4 py-3">
                          <span className="font-semibold text-ink-50">{formatMoney(t.value)}</span>
                          <span className="mt-1.5 block h-1 bg-ink-800/80">
                            <span
                              className={`bar-grow block h-full ${side.stripe}`}
                              style={{ width: `${Math.sqrt((t.value ?? 0) / maxValue) * 100}%` }}
                            />
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-ink-300">{format(parseISO(t.transactionDate), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3 pr-6 text-right">
                          <a
                            href={t.filingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block px-2.5 py-1 text-xs font-medium text-ink-500 opacity-60 transition hover:bg-ink-800 hover:text-brand-300 group-hover:opacity-100"
                            title="SEC filing"
                          >
                            Filing
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data && (
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                totalElements={data.totalElements}
                onPageChange={(p) => setParam({ page: String(p) })}
                noun="transactions"
              />
            )}
          </>
        ) : (
          <EmptyState message={ticker ? `No insider transactions found for ${ticker}.` : 'No corporate insider trades yet. The SEC Form 4 ingest may still be running.'} />
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
        <div role="tablist" aria-label="Trade source" className="relative flex bg-ink-900/80 p-1 shadow-lg shadow-black/20">
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
