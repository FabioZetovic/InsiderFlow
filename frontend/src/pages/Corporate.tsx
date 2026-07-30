import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Building2, ExternalLink } from 'lucide-react';
import { getCorporateInsiders } from '../api';
import type { InsiderTrade, PagedInsiders } from '../types';
import { Pagination } from '../components/Pagination';
import { Card, EmptyState, ErrorState, formatMoney, TableSkeleton } from '../components/ui';

function InsiderTypeBadge({ type }: { type: InsiderTrade['transactionType'] }) {
  const styles: Record<string, string> = {
    BUY: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
    SELL: 'bg-red-500/15 text-red-400 ring-red-500/30',
    GRANT: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
    OTHER: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
  };
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${styles[type]}`}>
      {type}
    </span>
  );
}

export function Corporate() {
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
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-100">
          <Building2 className="h-6 w-6 text-emerald-400" />
          Corporate Insiders
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          SEC Form 4 filings — company officers, directors, and 10% owners trading their own
          stock. Limited to companies Congress also trades, so you can compare both.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <input
            defaultValue={ticker}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setParam({ ticker: (e.target as HTMLInputElement).value.toUpperCase() });
            }}
            placeholder="Filter by ticker (Enter)"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
          />
          <div className="flex gap-1">
            {['', 'BUY', 'SELL'].map((t) => (
              <button
                key={t || 'ALL'}
                onClick={() => setParam({ type: t })}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  type === t ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {t || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={12} />
        ) : error ? (
          <ErrorState message="Failed to load corporate insider trades." onRetry={load} />
        ) : data && data.content.length > 0 ? (
          <>
            <div className={loading ? 'opacity-50' : ''}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3 font-medium">Ticker</th>
                      <th className="px-4 py-3 font-medium">Insider</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium text-right">Shares</th>
                      <th className="px-4 py-3 font-medium text-right">Value</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium text-right">Filing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.content.map((t) => (
                      <tr key={t.id} className="border-t border-zinc-800/60 even:bg-zinc-900/40">
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => navigate(`/insiders/ticker/${encodeURIComponent(t.ticker)}`)}
                            className="font-mono font-semibold text-zinc-100 hover:text-emerald-400"
                          >
                            {t.ticker}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="block text-zinc-200">{t.insiderName}</span>
                          {t.insiderTitle && <span className="block text-xs text-zinc-500">{t.insiderTitle}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <InsiderTypeBadge type={t.transactionType} />
                        </td>
                        <td className="px-4 py-2.5 text-right text-zinc-300">
                          {t.shares != null ? t.shares.toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-zinc-300">{formatMoney(t.value)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-zinc-400">
                          {format(parseISO(t.transactionDate), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <a
                            href={t.filingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-zinc-500 hover:text-emerald-400"
                            title="SEC filing"
                          >
                            <ExternalLink className="inline h-4 w-4" />
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
          <EmptyState message="No corporate insider trades yet — the SEC Form 4 ingest may still be running." />
        )}
      </Card>
    </div>
  );
}
