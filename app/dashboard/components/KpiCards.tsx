'use client';

import { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  color: 'blue' | 'green' | 'red' | 'orange';
  trend?: string;
}

function KpiCard({ label, value, icon, color, trend }: KpiCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
          <p className="text-4xl font-bold text-slate-900">{value}</p>
          {trend && (
            <p className="text-xs text-slate-500 mt-2">{trend}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

interface KpiCardsProps {
  totalDecisions: number;
  totalActions: number;
  highRiskCount: number;
  completionPercentage: number;
  escalatedCount?: number;
}

export function KpiCards({
  totalDecisions,
  totalActions,
  highRiskCount,
  completionPercentage,
  escalatedCount = 0,
}: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KpiCard
        label="Total Decisions"
        value={totalDecisions}
        icon={<span className="text-2xl">📋</span>}
        color="blue"
        trend={`${totalDecisions} strategic decisions`}
      />

      <KpiCard
        label="Action Items"
        value={totalActions}
        icon={<span className="text-2xl">✓</span>}
        color="green"
        trend={`${totalActions} tasks to complete`}
      />

      <KpiCard
        label="High Risk Items"
        value={highRiskCount}
        icon={<span className="text-2xl">⚠️</span>}
        color="red"
        trend={highRiskCount > 0 ? 'Requires attention' : 'No high-risk items'}
      />

      <KpiCard
        label="Completion Rate"
        value={`${completionPercentage}%`}
        icon={<span className="text-2xl">📈</span>}
        color="orange"
        trend={`${escalatedCount} escalated items`}
      />
    </div>
  );
}
