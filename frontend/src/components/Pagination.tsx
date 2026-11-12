interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
}

const BTN = 'px-3 py-1.5 text-xs font-medium text-ink-300 bg-ink-800/60 hover:bg-ink-700 hover:text-ink-50 disabled:opacity-30 disabled:hover:bg-ink-800/60';

export function Pagination({ page, totalPages, totalElements, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return <div className="px-4 py-4 text-xs text-ink-500">{totalElements.toLocaleString()} trades</div>;
  }
  return (
    <div className="flex items-center justify-between px-4 py-4 text-sm">
      <span className="text-xs text-ink-500">
        {totalElements.toLocaleString()} trades · page {page + 1} of {totalPages.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button disabled={page === 0} onClick={() => onPageChange(page - 1)} className={BTN}>
          Previous
        </button>
        <button disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className={BTN}>
          Next
        </button>
      </div>
    </div>
  );
}
