'use client';

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { useState } from 'react';

export interface Decision {
  id?: string;
  text: string;
  owner?: string;
  status?: string;
  severity?: string;
  meeting?: string;
  date?: string;
  is_escalated?: boolean;
}

interface DecisionsTableProps {
  decisions: Decision[];
  onSelectDecision?: (decision: Decision) => void;
}

export function DecisionsTable({ decisions, onSelectDecision }: DecisionsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  const columns: ColumnDef<Decision>[] = [
    {
      accessorKey: 'text',
      header: 'Decision',
      cell: (info) => (
        <div className="font-medium text-slate-900 max-w-md truncate">
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'owner',
      header: 'Owner',
      cell: (info) => (
        <span className="text-sm text-slate-600">
          {(info.getValue() as string) || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: (info) => {
        const status = info.getValue() as string;
        const statusColors: Record<string, string> = {
          pending: 'bg-orange-100 text-orange-800',
          in_progress: 'bg-blue-100 text-blue-800',
          completed: 'bg-green-100 text-green-800',
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[status] || 'bg-slate-100 text-slate-800'}`}>
            {status || '—'}
          </span>
        );
      },
    },
    {
      accessorKey: 'severity',
      header: 'Risk',
      cell: (info) => {
        const severity = info.getValue() as string;
        const severityColors: Record<string, string> = {
          low: 'bg-green-100 text-green-800',
          medium: 'bg-yellow-100 text-yellow-800',
          high: 'bg-red-100 text-red-800',
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded ${severityColors[severity] || 'bg-slate-100 text-slate-800'}`}>
            {severity || '—'}
          </span>
        );
      },
    },
    {
      accessorKey: 'meeting',
      header: 'Meeting',
      cell: (info) => (
        <span className="text-sm text-slate-600 max-w-xs truncate">
          {(info.getValue() as string) || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'is_escalated',
      header: 'Escalated',
      cell: (info) => (
        <span className="text-center">
          {(info.getValue() as boolean) ? '✓' : '—'}
        </span>
      ),
    },
  ];

  const table = useReactTable({
    data: decisions,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleRowClick = (decision: Decision) => {
    setSelectedDecision(decision);
    onSelectDecision?.(decision);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-100"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getCanSort() && (
                        <span className="text-xs text-slate-400">
                          {header.column.getIsSorted()
                            ? header.column.getIsSorted() === 'desc'
                              ? '↓'
                              : '↑'
                            : '↕'}
                        </span>
                      )}
                    </div>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-slate-200 hover:bg-blue-50 cursor-pointer transition ${
                    selectedDecision === row.original ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  No decisions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Decision Details Panel */}
      {selectedDecision && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Decision Details
            </h3>
            <button
              onClick={() => setSelectedDecision(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-2">
                Decision
              </h4>
              <p className="text-slate-900 leading-relaxed">
                {selectedDecision.text}
              </p>
            </div>

            <div className="space-y-4">
              {selectedDecision.owner && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-1">
                    Owner
                  </h4>
                  <p className="text-slate-900">{selectedDecision.owner}</p>
                </div>
              )}

              {selectedDecision.status && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-1">
                    Status
                  </h4>
                  <span className="inline-block px-3 py-1 text-sm font-medium rounded bg-slate-100 text-slate-900">
                    {selectedDecision.status}
                  </span>
                </div>
              )}

              {selectedDecision.severity && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-1">
                    Risk Level
                  </h4>
                  <span className={`inline-block px-3 py-1 text-sm font-medium rounded ${
                    selectedDecision.severity === 'high'
                      ? 'bg-red-100 text-red-900'
                      : selectedDecision.severity === 'medium'
                      ? 'bg-yellow-100 text-yellow-900'
                      : 'bg-green-100 text-green-900'
                  }`}>
                    {selectedDecision.severity}
                  </span>
                </div>
              )}

              {selectedDecision.meeting && (
                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-1">
                    From Meeting
                  </h4>
                  <p className="text-slate-900">{selectedDecision.meeting}</p>
                </div>
              )}
            </div>
          </div>

          {/* Task #5 Placeholders */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-3">
              Coming in next iteration:
            </p>
            <div className="space-y-2 text-sm">
              <div className="text-slate-400">
                • AI-Inferred Relationships - Decisions this decision blocks
              </div>
              <div className="text-slate-400">
                • Validation UI - Confirm or reject relationship inferences
              </div>
              <div className="text-slate-400">
                • Action Buttons - Mark escalated, resolved, or high priority
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
