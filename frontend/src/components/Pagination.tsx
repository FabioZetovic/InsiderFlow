interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  size?: number;
  noun?: string;
}

/** Page numbers around the current one, with gaps: 1 … 4 5 [6] 7 8 … 120 */
function pageWindow(page: number, total: number): (number | 'gap')[] {
  const pages = new Set([0, total - 1, page - 2, page - 1, page, page + 1, page + 2]);
  const sorted = [...pages].filter((p) => p >= 0 && p < total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const STEP = 'px-3 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-50 disabled:opacity-30 disabled:hover:bg-transparent';

export function Pagination({ page, totalPages, totalElements, onPageChange, size = 50, noun = 'trades' }: PaginationProps) {
  const first = totalElements === 0 ? 0 : page * size + 1;
  const last = Math.min((page + 1) * size, totalElements);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <span className="text-xs text-ink-500">
        Showing <span className="font-semibold text-ink-200">{first.toLocaleString()}–{last.toLocaleString()}</span> of{' '}
        <span className="font-semibold text-ink-200">{totalElements.toLocaleString()}</span> {noun}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button disabled={page === 0} onClick={() => onPageChange(page - 1)} className={STEP}>
            Previous
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1.5 text-xs text-ink-600">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-8 px-2 py-1.5 text-xs font-semibold transition-colors ${
                  p === page ? 'bg-brand-600 text-white' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-50'
                }`}
              >
                {(p + 1).toLocaleString()}
              </button>
            ),
          )}
          <button disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className={STEP}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
