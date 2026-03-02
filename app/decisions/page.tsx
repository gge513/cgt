'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FilterBar } from './components/FilterBar';
import { DecisionsTable, Decision } from './components/DecisionsTable';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Decisions() {
  const [status, setStatus] = useState<string>('');
  const [severity, setSeverity] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  const queryParams = new URLSearchParams();
  if (status) queryParams.append('status', status);
  if (severity) queryParams.append('severity', severity);
  if (keyword) queryParams.append('keyword', keyword);

  const { data, isLoading, error } = useQuery({
    queryKey: ['kms-decisions', status, severity, keyword],
    queryFn: () =>
      fetch(`/api/kms/decisions?${queryParams}`).then((res) => res.json()),
  });

  const decisions = data?.decisions || [];
  const totalCount = data?.total || 0;
  const filteredCount = data?.filtered || 0;

  const handleResetFilters = () => {
    setStatus('');
    setSeverity('');
    setKeyword('');
    setSelectedDecision(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-8">
            Decisions Explorer
          </h1>
          <div className="flex items-center gap-2 text-slate-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></div>
            Loading decisions...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-8">
            Decisions Explorer
          </h1>
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">Error loading decisions</p>
            <p className="text-sm mt-1">
              {error instanceof Error ? error.message : 'Failed to load decisions'}
            </p>
          </div>
          <p className="mt-4 text-slate-600 text-sm">
            Make sure to run <code className="bg-slate-200 px-2 py-1 rounded">npm run analyze</code> first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold text-slate-900">
              Decisions Explorer
            </h1>
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Back to Dashboard
            </Link>
          </div>
          <p className="text-slate-600">
            View and explore all strategic decisions with filters, sorting, and detailed drill-down
          </p>
        </div>

        {/* Filter Bar */}
        <FilterBar
          status={status}
          severity={severity}
          keyword={keyword}
          onStatusChange={setStatus}
          onSeverityChange={setSeverity}
          onKeywordChange={setKeyword}
          onReset={handleResetFilters}
        />

        {/* Results Summary */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{filteredCount}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalCount}</span> decisions
          </div>
          {decisions.length > 0 && (
            <div className="text-xs text-slate-500">
              Click a row to view details
            </div>
          )}
        </div>

        {/* Decisions Table */}
        <DecisionsTable
          decisions={decisions}
          onSelectDecision={setSelectedDecision}
        />

        {/* Empty State */}
        {decisions.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500 mb-4">
              No decisions found matching your filters.
            </p>
            <button
              onClick={handleResetFilters}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Coming Soon Features */}
        {decisions.length > 0 && (
          <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-900">
              <strong>Next features:</strong> Task #6 will add AI-inferred decision relationships with validation UI, and Task #7 will add strategic action buttons (escalate, resolve, prioritize).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
