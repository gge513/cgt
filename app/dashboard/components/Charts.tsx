'use client';

import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ChartProps {
  statusDistribution: {
    pending: number;
    in_progress: number;
    completed: number;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

const STATUS_COLORS = {
  pending: '#f97316', // orange
  in_progress: '#3b82f6', // blue
  completed: '#22c55e', // green
};

const RISK_COLORS = {
  low: '#22c55e', // green
  medium: '#f97316', // orange
  high: '#ef4444', // red
};

export function Charts({ statusDistribution, riskDistribution }: ChartProps) {
  // Transform status data for pie chart
  const statusData = [
    { name: 'Pending', value: statusDistribution.pending },
    { name: 'In Progress', value: statusDistribution.in_progress },
    { name: 'Completed', value: statusDistribution.completed },
  ].filter((item) => item.value > 0);

  // Transform risk data for bar chart
  const riskData = [
    { name: 'Low', value: riskDistribution.low },
    { name: 'Medium', value: riskDistribution.medium },
    { name: 'High', value: riskDistribution.high },
  ];

  const statusColorValues = statusData.map(
    (item) =>
      STATUS_COLORS[item.name.toLowerCase().replace(' ', '_') as keyof typeof STATUS_COLORS]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Decision Status Pie Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Decision Status</h3>
        {statusData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColorValues[index]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-500">
            No decision data available
          </div>
        )}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.pending }}></span>
            <span className="text-slate-600">Pending: {statusDistribution.pending}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.in_progress }}></span>
            <span className="text-slate-600">In Progress: {statusDistribution.in_progress}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.completed }}></span>
            <span className="text-slate-600">Completed: {statusDistribution.completed}</span>
          </div>
        </div>
      </div>

      {/* Risk Distribution Bar Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Risk Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={riskData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
              {riskData.map((entry, index) => {
                const colors = [RISK_COLORS.low, RISK_COLORS.medium, RISK_COLORS.high];
                return <Cell key={`cell-${index}`} fill={colors[index]} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: RISK_COLORS.low }}></span>
            <span className="text-slate-600">Low Risk: {riskDistribution.low}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: RISK_COLORS.medium }}></span>
            <span className="text-slate-600">Medium Risk: {riskDistribution.medium}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: RISK_COLORS.high }}></span>
            <span className="text-slate-600">High Risk: {riskDistribution.high}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
