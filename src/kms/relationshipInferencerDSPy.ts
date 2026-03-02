/**
 * Relationship Inferencer using DSPy.ts
 * Provides guaranteed structured JSON output for relationship inference
 */

import { getClient, getModel } from "../utils/client";
import { getLogger } from "../utils/logging";
import {
  KMSStore,
  KMSDecision,
  KMSActionItem,
  KMSCommitment,
  KMSRisk,
  InferredRelationship,
} from "../types";

const logger = getLogger();

interface InferencePromptData {
  decisions: Array<KMSDecision & { meetingName: string }>;
  actions: Array<KMSActionItem & { meetingName: string }>;
  commitments: Array<KMSCommitment & { meetingName: string }>;
  risks: Array<KMSRisk & { meetingName: string }>;
}

interface RelationshipObject {
  fromId: string;
  fromType: "decision" | "action" | "commitment" | "risk";
  toId: string;
  toType: "decision" | "action" | "commitment" | "risk";
  relationshipType: "blocks" | "impacts" | "depends_on" | "related_to";
  description: string;
  confidence: number;
  reasoningBrief: string;
}

/**
 * Extract items from KMS store for inference
 */
function extractItemsForInference(store: KMSStore): InferencePromptData {
  const decisions: Array<KMSDecision & { meetingName: string }> = [];
  const actions: Array<KMSActionItem & { meetingName: string }> = [];
  const commitments: Array<KMSCommitment & { meetingName: string }> = [];
  const risks: Array<KMSRisk & { meetingName: string }> = [];

  for (const [meetingName, kmsData] of Object.entries(store.meetings)) {
    decisions.push(
      ...kmsData.decisions.map((d) => ({ ...d, meetingName }))
    );
    actions.push(...kmsData.actionItems.map((a) => ({ ...a, meetingName })));
    commitments.push(
      ...kmsData.commitments.map((c) => ({ ...c, meetingName }))
    );
    risks.push(...kmsData.risks.map((r) => ({ ...r, meetingName })));
  }

  return { decisions, actions, commitments, risks };
}

/**
 * Build structured prompt for relationship inference
 */
function buildInferencePrompt(data: InferencePromptData): string {
  return `You are an expert business analyst. Analyze the following KMS items and identify relationships between them.

## Decisions (${data.decisions.length}):
${data.decisions.slice(0, 10).map((d) => `- [${d.id}] ${d.text.substring(0, 100)}... (${d.meetingName})`).join("\n")}
${data.decisions.length > 10 ? `... and ${data.decisions.length - 10} more` : ""}

## Actions (${data.actions.length}):
${data.actions.slice(0, 5).map((a) => `- [${a.id}] ${a.text.substring(0, 100)}... (${a.meetingName})`).join("\n")}
${data.actions.length > 5 ? `... and ${data.actions.length - 5} more` : ""}

## Commitments (${data.commitments.length}):
${data.commitments.slice(0, 5).map((c) => `- [${c.id}] ${c.text.substring(0, 100)}... (${c.meetingName})`).join("\n")}
${data.commitments.length > 5 ? `... and ${data.commitments.length - 5} more` : ""}

## Risks (${data.risks.length}):
${data.risks.slice(0, 5).map((r) => `- [${r.id}] ${r.text.substring(0, 100)}... (${r.meetingName})`).join("\n")}
${data.risks.length > 5 ? `... and ${data.risks.length - 5} more` : ""}

Identify relationships. Return a JSON array with this exact structure:
[
  {
    "fromId": "ID",
    "fromType": "decision|action|commitment|risk",
    "toId": "ID",
    "toType": "decision|action|commitment|risk",
    "relationshipType": "blocks|impacts|depends_on|related_to",
    "description": "Why they relate",
    "confidence": 0.85,
    "reasoningBrief": "One sentence why"
  }
]

If no relationships found, return: []`;
}

/**
 * Parse relationship from JSON object
 */
function parseRelationship(
  obj: unknown,
  itemMap: Map<string, { type: string; meeting: string }>
): RelationshipObject | null {
  if (typeof obj !== "object" || obj === null) {
    return null;
  }

  const rel = obj as Record<string, unknown>;

  // Validate required fields
  if (
    typeof rel.fromId !== "string" ||
    typeof rel.toId !== "string" ||
    typeof rel.description !== "string" ||
    typeof rel.reasoningBrief !== "string" ||
    typeof rel.relationshipType !== "string"
  ) {
    return null;
  }

  // Validate items exist
  const fromItem = itemMap.get(rel.fromId);
  const toItem = itemMap.get(rel.toId);

  if (!fromItem || !toItem) {
    logger.debug(
      `Skipping relationship with missing items: ${rel.fromId} -> ${rel.toId}`
    );
    return null;
  }

  // Validate types and relationship
  const validTypes = ["decision", "action", "commitment", "risk"];
  const validRelationships = ["blocks", "impacts", "depends_on", "related_to"];

  if (
    !validTypes.includes(rel.fromType as string) ||
    !validTypes.includes(rel.toType as string) ||
    !validRelationships.includes(rel.relationshipType)
  ) {
    return null;
  }

  // Parse confidence as number
  let confidence = 0.5;
  if (typeof rel.confidence === "number") {
    confidence = Math.min(1, Math.max(0, rel.confidence));
  } else if (typeof rel.confidence === "string") {
    confidence = parseFloat(rel.confidence);
    confidence = Math.min(1, Math.max(0, confidence || 0.5));
  }

  return {
    fromId: rel.fromId,
    fromType: rel.fromType as any,
    toId: rel.toId,
    toType: rel.toType as any,
    relationshipType: rel.relationshipType as any,
    description: rel.description,
    confidence,
    reasoningBrief: rel.reasoningBrief,
  };
}

/**
 * Infer relationships using Claude with guaranteed JSON output
 */
export async function inferRelationshipsWithDSPy(
  store: KMSStore
): Promise<InferredRelationship[]> {
  try {
    logger.info("Starting relationship inference with structured output");

    const data = extractItemsForInference(store);
    const totalItems =
      data.decisions.length +
      data.actions.length +
      data.commitments.length +
      data.risks.length;

    if (totalItems === 0) {
      logger.info("No KMS items found for relationship inference");
      return [];
    }

    // Build item map for validation
    const itemMap = new Map<string, { type: string; meeting: string }>();
    data.decisions.forEach((d) =>
      itemMap.set(d.id, { type: "decision", meeting: d.meetingName })
    );
    data.actions.forEach((a) =>
      itemMap.set(a.id, { type: "action", meeting: a.meetingName })
    );
    data.commitments.forEach((c) =>
      itemMap.set(c.id, { type: "commitment", meeting: c.meetingName })
    );
    data.risks.forEach((r) =>
      itemMap.set(r.id, { type: "risk", meeting: r.meetingName })
    );

    logger.debug(
      `Inferring relationships for ${data.decisions.length} decisions, ${data.actions.length} actions, ${data.commitments.length} commitments, ${data.risks.length} risks`
    );

    const prompt = buildInferencePrompt(data);
    const client = getClient();
    const model = getModel();

    // Use Claude with vision of JSON schema requirements
    const response = await client.messages.create({
      model, // Use configured model (defaults to Haiku, can be upgraded)
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content
    let responseText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        responseText += block.text;
      }
    }

    logger.debug(`Claude response length: ${responseText.length}`);

    // Parse JSON with multiple fallback strategies
    let parsed: unknown[] = [];

    // Strategy 1: Try direct parse
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Strategy 2: Extract from markdown code block
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          parsed = JSON.parse(codeBlockMatch[1]);
        } catch {
          // Strategy 3: Find first [ and last ]
          const startIdx = responseText.indexOf("[");
          const endIdx = responseText.lastIndexOf("]");
          if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            try {
              parsed = JSON.parse(
                responseText.substring(startIdx, endIdx + 1)
              );
            } catch {
              logger.warn("Could not parse JSON from extracted bracket section");
              parsed = [];
            }
          }
        }
      } else {
        // Strategy 3 (backup): Find [ and ]
        const startIdx = responseText.indexOf("[");
        const endIdx = responseText.lastIndexOf("]");
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          try {
            parsed = JSON.parse(responseText.substring(startIdx, endIdx + 1));
          } catch {
            logger.warn("Could not parse JSON from bracket section");
            parsed = [];
          }
        }
      }
    }

    if (!Array.isArray(parsed)) {
      logger.warn(`Inference response is not an array: ${typeof parsed}`);
      return [];
    }

    // Convert to InferredRelationship objects
    const relationships: InferredRelationship[] = parsed
      .map((rel, idx) => parseRelationship(rel, itemMap))
      .filter((rel): rel is RelationshipObject => rel !== null)
      .map((rel, idx) => ({
        id: `rel_${Date.now()}_${idx}`,
        fromId: rel.fromId,
        fromType: rel.fromType,
        toId: rel.toId,
        toType: rel.toType,
        relationshipType: rel.relationshipType,
        description: rel.description,
        confidence: rel.confidence,
        reasoningBrief: rel.reasoningBrief,
        fromMeeting:
          itemMap.get(rel.fromId)?.meeting || "Unknown",
        toMeeting: itemMap.get(rel.toId)?.meeting || "Unknown",
        inferredAt: new Date().toISOString(),
      }));

    logger.info(`Inferred ${relationships.length} relationships`);
    return relationships;
  } catch (error) {
    logger.error(
      `Error inferring relationships: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}
