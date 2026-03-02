// Types for the KMS dashboard UI

export interface InferredRelationship {
  id: string;
  fromId: string;
  fromType: "decision" | "action" | "commitment" | "risk";
  toId: string;
  toType: "decision" | "action" | "commitment" | "risk";
  relationshipType: "blocks" | "impacts" | "depends_on" | "related_to";
  description: string;
  confidence: number;
  reasoningBrief: string;
  fromMeeting: string;
  toMeeting: string;
  inferredAt: string;
  validated?: boolean;
  validatedAt?: string;
}

export interface InferredRelationshipsStore {
  version: 1;
  inferredAt: string;
  totalRelationships: number;
  relationships: InferredRelationship[];
}

