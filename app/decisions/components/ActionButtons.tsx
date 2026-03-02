'use client';

import { useState } from 'react';
import { Decision } from './DecisionsTable';

interface ActionButtonsProps {
  decision: Decision;
  onActionSuccess?: (action: string) => void;
}

export function ActionButtons({
  decision,
  onActionSuccess,
}: ActionButtonsProps) {
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/kms/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisionId: decision.id,
          action,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to perform action');
      }

      setToastMessage(`✓ ${action} successful`);
      onActionSuccess?.(action);

      setTimeout(() => setToastMessage(null), 3000);
    } catch (error) {
      console.error('Action failed:', error);
      setToastMessage('✗ Action failed');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mt-6 pt-6 border-t border-slate-200">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          Strategic Actions
        </h4>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleAction('escalate')}
            disabled={loading || decision.is_escalated}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              decision.is_escalated
                ? 'bg-red-100 text-red-600 cursor-default'
                : 'bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200'
            } disabled:opacity-50`}
          >
            {decision.is_escalated ? '🚨 Escalated' : '📢 Mark Escalated'}
          </button>

          <button
            onClick={() => handleAction('resolve')}
            disabled={loading || decision.status === 'resolved'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              decision.status === 'resolved'
                ? 'bg-green-100 text-green-600 cursor-default'
                : 'bg-green-50 text-green-700 hover:bg-green-100 active:bg-green-200'
            } disabled:opacity-50`}
          >
            {decision.status === 'resolved' ? '✅ Resolved' : '📋 Mark Resolved'}
          </button>

          <button
            onClick={() => handleAction('high-priority')}
            disabled={loading || decision.severity === 'high'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              decision.severity === 'high'
                ? 'bg-orange-100 text-orange-600 cursor-default'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 active:bg-orange-200'
            } disabled:opacity-50`}
          >
            {decision.severity === 'high' ? '⚡ High Priority' : '⭐ Set High Priority'}
          </button>
        </div>

        {toastMessage && (
          <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${
            toastMessage.startsWith('✗')
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-700'
          }`}>
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
