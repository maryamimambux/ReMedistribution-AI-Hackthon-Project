import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

/**
 * SearchFilterBar — Reusable search + filter + sort component
 *
 * Props:
 * - search: string, onSearchChange: (value) => void
 * - filters: Array<{ key, label, options: [{ value, label }] }>
 * - activeFilters: { [key]: value }, onFilterChange: (key, value) => void
 * - sortOptions: [{ value, label }], sortValue: string, onSortChange: (value) => void
 * - sortOrder: 'asc' | 'desc', onSortOrderChange: (order) => void
 */
export default function SearchFilterBar({
  search = '',
  onSearchChange,
  filters = [],
  activeFilters = {},
  onFilterChange,
  sortOptions = [],
  sortValue = '',
  onSortChange,
  sortOrder = 'desc',
  onSortOrderChange,
  placeholder = 'Search...',
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(debouncedSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [debouncedSearch]);

  const hasActiveFilters = filters.some((f) => activeFilters[f.key] && activeFilters[f.key] !== '');
  const clearAll = () => {
    setDebouncedSearch('');
    filters.forEach((f) => onFilterChange(f.key, ''));
    if (onSortChange) onSortChange('');
  };

  return (
    <div className="space-y-3 mb-6">
      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={debouncedSearch}
            onChange={(e) => setDebouncedSearch(e.target.value)}
            className="input-field pl-10 w-full"
            placeholder={placeholder}
          />
          {debouncedSearch && (
            <button
              onClick={() => setDebouncedSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {filters.length > 0 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition ${
              showFilters || hasActiveFilters
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* Sort bar */}
      {sortOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort by:</span>
          <select
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
          >
            <option value="">Default</option>
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {onSortOrderChange && sortValue && (
            <button
              onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="text-xs text-gray-500 hover:text-emerald-600 px-2 py-1.5 border border-gray-200 rounded-lg hover:bg-emerald-50 transition"
            >
              {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          )}
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 ml-auto">
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Filter dropdowns */}
      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          {filters.map((f) => (
            <div key={f.key} className="min-w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <select
                value={activeFilters[f.key] || ''}
                onChange={(e) => onFilterChange(f.key, e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="">All</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
