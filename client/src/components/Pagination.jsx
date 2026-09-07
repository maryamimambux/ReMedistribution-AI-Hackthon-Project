import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination — Page navigation component
 *
 * Props:
 * - currentPage: number (1-based)
 * - totalPages: number
 * - onPageChange: (page) => void
 * - totalItems: number (optional, for "Showing X of Y" text)
 */
export default function Pagination({ currentPage, totalPages, onPageChange, totalItems }) {
  if (totalPages <= 1) return null;

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-6 px-1">
      {totalItems !== undefined && (
        <span className="text-xs text-gray-500">
          Showing {totalItems > 0 ? Math.min((currentPage - 1) * 20 + 1, totalItems) : 0}-{Math.min(currentPage * 20, totalItems)} of {totalItems}
        </span>
      )}

      <div className={`flex items-center gap-1 ${totalItems !== undefined ? '' : 'mx-auto'}`}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                page === currentPage
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
