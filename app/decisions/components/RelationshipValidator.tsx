'use client';

import { useState } from 'react';
import { InferredRelationship } from '@/types';

interface RelationshipValidatorProps {
  relationships: InferredRelationship[];
  decisionId: string;
  decisionText: string;
  onValidate?: (relationshipId: string, validated: boolean) => void;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  blocks: '🚫 Blocks',
  impacts: '⚠️ Impacts',
  depends_on: '🔗 Depends on',
  related_to: '🔄 Related to',
};

const CONFIDENCE_COLOR = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-700 bg-green-100';
  if (confidence >= 0.6) return 'text-blue-700 bg-blue-100';
  return 'text-yellow-700 bg-yellow-100';
};

export function RelationshipValidator({
  relationships,
  decisionId,
  decisionText,
  onValidate,
}: RelationshipValidatorProps) {
  const [validatedIds, setValidatedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  if (relationships.length === 0) {
    return null;
  }

  // Separate relationships by direction (from this decision vs to this decision)
  const outgoing = relationships.filter((r) => r.fromId === decisionId);
  const incoming = relationships.filter((r) => r.toId === decisionId);

  const handleValidate = (relationshipId: string, confirmed: boolean) => {
    if (confirmed) {
      setValidatedIds((prev) => new Set([...prev, relationshipId]));
      setRejectedIds((prev) => {
        const next = new Set(prev);
        next.delete(relationshipId);
        return next;
      });
    } else {
      setRejectedIds((prev) => new Set([...prev, relationshipId]));
      setValidatedIds((prev) => {
        const next = new Set(prev);
        next.delete(relationshipId);
        return next;
      });
    }

    onValidate?.(relationshipId, confirmed);
  };

  return (
    <div className="mt-6 pt-6 border-t border-slate-200">
      <h4 className="text-sm font-semibold text-slate-900 mb-4">
        🤖 AI-Inferred Relationships
      </h4>

      <div className="space-y-4">
        {/* Outgoing relationships - This decision blocks/impacts/depends on others */}
        {outgoing.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-3">
              This decision...
            </p>
            <div className="space-y-2">
              {outgoing.map((rel) => (
                <RelationshipCard
                  key={rel.id}
                  relationship={rel}
                  direction="outgoing"
                  isValidated={validatedIds.has(rel.id)}
                  isRejected={rejectedIds.has(rel.id)}
                  onValidate={handleValidate}
                />
              ))}
            </div>
          </div>
        )}

        {/* Incoming relationships - Other items block/impact/depend on this decision */}
        {incoming.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-600 mb-3">
              Other items...
            </p>
            <div className="space-y-2">
              {incoming.map((rel) => (
                <RelationshipCard
                  key={rel.id}
                  relationship={rel}
                  direction="incoming"
                  isValidated={validatedIds.has(rel.id)}
                  isRejected={rejectedIds.has(rel.id)}
                  onValidate={handleValidate}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-slate-500">
        <p>
          💡 Tip: Confirm relationships you agree with. This helps improve AI
          recommendations over time.
        </p>
      </div>
    </div>
  );
}

interface RelationshipCardProps {
  relationship: InferredRelationship;
  direction: 'incoming' | 'outgoing';
  isValidated: boolean;
  isRejected: boolean;
  onValidate: (id: string, confirmed: boolean) => void;
}

function RelationshipCard({
  relationship,
  direction,
  isValidated,
  isRejected,
  onValidate,
}: RelationshipCardProps) {
  const getTitle = () => {
    const fromType = relationship.fromType.charAt(0).toUpperCase() + relationship.fromType.slice(1);
    const toType = relationship.toType.charAt(0).toUpperCase() + relationship.toType.slice(1);

    if (direction === 'outgoing') {
      return `${RELATIONSHIP_LABELS[relationship.relationshipType]} ${toType}`;
    } else {
      return `${fromType} ${RELATIONSHIP_LABELS[relationship.relationshipType]}`;
    }
  };

  const getItemLabel = () => {
    if (direction === 'outgoing') {
      return relationship.toId;
    } else {
      return relationship.fromId;
    }
  };

  const getMeeting = () => {
    if (direction === 'outgoing') {
      return relationship.toMeeting;
    } else {
      return relationship.fromMeeting;
    }
  };

  const confidencePercent = Math.round(relationship.confidence * 100);

  return (
    <div
      className={`p-4 rounded-lg border-2 transition ${
        isValidated
          ? 'bg-green-50 border-green-300'
          : isRejected
          ? 'bg-red-50 border-red-300'
          : 'bg-slate-50 border-slate-200 hover:border-blue-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h5 className="text-sm font-semibold text-slate-900">
            {getTitle()}
          </h5>
          <p className="text-xs text-slate-600 mt-1">
            {relationship.description}
          </p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-semibold ${CONFIDENCE_COLOR(relationship.confidence)}`}>
          {confidencePercent}% confident
        </div>
      </div>

      <div className="mb-3 text-xs text-slate-600">
        <p>
          <span className="font-medium">{getItemLabel()}</span> from meeting{' '}
          <span className="font-medium">{getMeeting()}</span>
        </p>
        <p className="mt-1 italic text-slate-500">
          {relationship.reasoningBrief}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onValidate(relationship.id, true)}
          className={`px-3 py-1 rounded text-xs font-medium transition ${
            isValidated
              ? 'bg-green-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-green-200'
          }`}
        >
          ✓ Correct
        </button>
        <button
          onClick={() => onValidate(relationship.id, false)}
          className={`px-3 py-1 rounded text-xs font-medium transition ${
            isRejected
              ? 'bg-red-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-red-200'
          }`}
        >
          ✗ Disagree
        </button>
      </div>
    </div>
  );
}
