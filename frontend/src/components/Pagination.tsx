import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, totalElements, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return (
      <div className="px-4 py-3 text-xs text-ink-500">{totalElements.toLocaleString()} trades</div>
    );
  }
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-xs text-ink-500">
        {totalElements.toLocaleString()} trades · page {page + 1} of {totalPages.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          className="flex items-center gap-1 rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-300 disabled:opacity-40 hover:bg-ink-800 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </button>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          className="flex items-center gap-1 rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-300 disabled:opacity-40 hover:bg-ink-800 transition-colors"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
