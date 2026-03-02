'use client';

interface FilterBarProps {
  status: string;
  severity: string;
  keyword: string;
  onStatusChange: (status: string) => void;
  onSeverityChange: (severity: string) => void;
  onKeywordChange: (keyword: string) => void;
  onReset: () => void;
}

export function FilterBar({
  status,
  severity,
  keyword,
  onStatusChange,
  onSeverityChange,
  onKeywordChange,
  onReset,
}: FilterBarProps) {
  const hasActiveFilters = status || severity || keyword;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Filters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Risk Level
          </label>
          <select
            value={severity}
            onChange={(e) => onSeverityChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Keyword Search */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Keyword
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="Search decisions..."
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Reset Button */}
        <div className="flex items-end">
          <button
            onClick={onReset}
            disabled={!hasActiveFilters}
            className={`w-full px-4 py-2 rounded-md text-sm font-medium transition ${
              hasActiveFilters
                ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap gap-2">
          {status && (
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
              Status: {status}
              <button
                onClick={() => onStatusChange('')}
                className="ml-1 hover:text-blue-900"
              >
                ✕
              </button>
            </div>
          )}
          {severity && (
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-medium">
              Risk: {severity}
              <button
                onClick={() => onSeverityChange('')}
                className="ml-1 hover:text-red-900"
              >
                ✕
              </button>
            </div>
          )}
          {keyword && (
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
              Keyword: {keyword}
              <button
                onClick={() => onKeywordChange('')}
                className="ml-1 hover:text-green-900"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
