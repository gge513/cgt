'use client';

import { useQuery } from '@tanstack/react-query';
import { KpiCards } from './components/KpiCards';
import { Charts } from './components/Charts';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['kms-summary'],
    queryFn: () => fetch('/api/kms/summary').then((res) => res.json()),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 mb-8">
            Strategic Dashboard
          </h1>
          <div className="flex items-center gap-2 text-slate-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></div>
            Loading KMS data...
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
            Strategic Dashboard
          </h1>
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">Error loading KMS data</p>
            <p className="text-sm mt-1">
              {error instanceof Error ? error.message : 'Failed to load KMS data'}
            </p>
          </div>
          <p className="mt-4 text-slate-600 text-sm">
            Make sure to run <code className="bg-slate-200 px-2 py-1 rounded">npm run analyze</code> first to generate KMS data.
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const statusDist = data?.status_distribution || { pending: 0, in_progress: 0, completed: 0 };
  const riskDist = data?.risk_distribution || { low: 0, medium: 0, high: 0 };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Strategic Dashboard
          </h1>
          <p className="text-slate-600">
            Executive overview of decisions, actions, commitments, and risks across all meetings
          </p>
        </div>

        {/* KPI Cards */}
        <div className="mb-8">
          <KpiCards
            totalDecisions={summary.total_decisions || 0}
            totalActions={summary.total_actions || 0}
            highRiskCount={summary.high_risk_count || 0}
            completionPercentage={summary.completion_percentage || 0}
            escalatedCount={summary.escalated_count || 0}
          />
        </div>

        {/* Charts */}
        <Charts
          statusDistribution={statusDist}
          riskDistribution={riskDist}
        />

        {/* Navigation & Details */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Explore Decisions Button */}
          <Link
            href="/decisions"
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md hover:border-blue-300 transition"
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-2">🔍 Explore Decisions</h3>
            <p className="text-sm text-slate-600 mb-4">
              View all decisions with filtering, drill-down details, and AI-inferred relationships
            </p>
            <span className="text-blue-600 font-medium">View Details →</span>
          </Link>

          {/* Summary Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">📊 Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Items</span>
                <span className="font-semibold text-slate-900">
                  {summary.total_items || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Commitments</span>
                <span className="font-semibold text-slate-900">
                  {summary.total_commitments || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Risks</span>
                <span className="font-semibold text-slate-900">
                  {summary.total_risks || 0}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200">
                <span className="text-slate-600">Meetings Analyzed</span>
                <span className="font-semibold text-slate-900">
                  {summary.total_meetings || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Last Updated */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">ℹ️ Information</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-600">Last Updated</span>
                <p className="font-semibold text-slate-900 truncate">
                  {summary.last_updated || 'Never'}
                </p>
              </div>
              <div>
                <span className="text-slate-600">Next Steps</span>
                <p className="text-slate-600 text-xs mt-1">
                  Run <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">npm run analyze</code> to refresh KMS data
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Task #5 Preview */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Coming soon:</strong> Task #5 will add the Decisions Explorer with relationship inference validation and strategic action buttons (escalate, resolve, prioritize).
          </p>
        </div>
      </div>
    </div>
  );
}
