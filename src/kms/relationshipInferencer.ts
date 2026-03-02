/**
 * Relationship Inferencer for KMS
 * Uses Claude API to infer relationships between decisions, actions, commitments, and risks
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
import { sanitizeStructuredData } from "../utils/parsing";

const logger = getLogger();

interface InferencePromptData {
  decisions: Array<KMSDecision & { meetingName: string }>;
  actions: Array<KMSActionItem & { meetingName: string }>;
  commitments: Array<KMSCommitment & { meetingName: string }>;
  risks: Array<KMSRisk & { meetingName: string }>;
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
 * Build prompt for Claude to infer relationships
 */
function buildInferencePrompt(data: InferencePromptData): string {
  const prompt = `You are an expert business analyst. Analyze the following decisions, actions, commitments, and risks from multiple meetings and identify relationships between them.

## Decisions:
${data.decisions.map((d) => `- [${d.id}] ${sanitizeStructuredData(d.text)} (Meeting: ${d.meetingName})`).join("\n")}

## Actions:
${data.actions.map((a) => `- [${a.id}] ${sanitizeStructuredData(a.text)} (Meeting: ${a.meetingName})`).join("\n")}

## Commitments:
${data.commitments.map((c) => `- [${c.id}] ${sanitizeStructuredData(c.text)} (Meeting: ${c.meetingName})`).join("\n")}

## Risks:
${data.risks.map((r) => `- [${r.id}] ${sanitizeStructuredData(r.text)} (Meeting: ${r.meetingName})`).join("\n")}

For each relationship you identify, provide a JSON object with:
- fromId: ID of the source item
- fromType: Type (decision|action|commitment|risk)
- toId: ID of the target item
- toType: Type (decision|action|commitment|risk)
- relationshipType: One of (blocks|impacts|depends_on|related_to)
- description: Clear description of how they relate
- confidence: Number 0-1 indicating how confident you are
- reasoningBrief: One sentence explaining why

Focus on:
1. Dependencies: Does one item block or depend on another?
2. Impacts: Could a risk affect a decision or action?
3. Related themes: Do items address the same topic across meetings?
4. Cross-meeting patterns: Are similar decisions being made in different meetings?

Return ONLY a JSON array of relationship objects. Do not include any text before or after the JSON array. If you find no relationships, return: []

IMPORTANT: Your response must start with [ and end with ], with nothing else.`;

  return prompt;
}

/**
 * Parse Claude's response to extract relationships
 */
function parseInferenceResponse(
  response: string,
  itemMap: Map<string, { type: string; meeting: string }>
): InferredRelationship[] {
  try {
    // Clean up response
    let cleanedResponse = response.trim();

    // Strategy 1: Remove markdown code block wrappers if present
    const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleanedResponse = codeBlockMatch[1].trim();
    }

    // Strategy 2: Try to match [...]
    let jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);

    // Strategy 3: Find first [ and last ]
    if (!jsonMatch) {
      const startIdx = cleanedResponse.indexOf('[');
      const endIdx = cleanedResponse.lastIndexOf(']');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonMatch = [cleanedResponse.substring(startIdx, endIdx + 1)];
      }
    }

    // Strategy 4: If response is empty or just [], return empty array
    if (!jsonMatch && (cleanedResponse === '[]' || cleanedResponse === '')) {
      logger.info("Inference returned no relationships");
      return [];
    }

    if (!jsonMatch) {
      logger.warn("No JSON array found in inference response");
      logger.debug(`Response (first 500 chars): ${cleanedResponse.substring(0, 500)}`);
      return [];
    }

    // Extract and clean the JSON string
    let jsonStr = jsonMatch[0].trim();

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      logger.warn("Inference response is not an array");
      return [];
    }

    // Allowlist of valid types and relationship types
    const validTypes = new Set(["decision", "action", "commitment", "risk"]);
    const validRelationshipTypes = new Set([
      "blocks",
      "impacts",
      "depends_on",
      "related_to",
    ]);

    return parsed
      .map((rel, idx) => {
        // Validate type fields
        if (
          typeof rel.fromId !== "string" ||
          typeof rel.toId !== "string" ||
          typeof rel.fromType !== "string" ||
          typeof rel.toType !== "string" ||
          typeof rel.relationshipType !== "string" ||
          typeof rel.description !== "string" ||
          typeof rel.reasoningBrief !== "string"
        ) {
          logger.debug(`Skipping relationship with invalid field types`);
          return null;
        }

        // Validate against allowlists
        if (!validTypes.has(rel.fromType) || !validTypes.has(rel.toType)) {
          logger.debug(
            `Skipping relationship with invalid type: ${rel.fromType} -> ${rel.toType}`
          );
          return null;
        }

        if (!validRelationshipTypes.has(rel.relationshipType)) {
          logger.debug(
            `Skipping relationship with invalid relationshipType: ${rel.relationshipType}`
          );
          return null;
        }

        const fromItem = itemMap.get(rel.fromId);
        const toItem = itemMap.get(rel.toId);

        if (!fromItem || !toItem) {
          logger.debug(
            `Skipping relationship with missing items: ${rel.fromId} -> ${rel.toId}`
          );
          return null;
        }

        return {
          id: `rel_${Date.now()}_${idx}`,
          fromId: rel.fromId.substring(0, 50),
          fromType: rel.fromType,
          toId: rel.toId.substring(0, 50),
          toType: rel.toType,
          relationshipType: rel.relationshipType,
          description: rel.description.substring(0, 500),
          confidence: Math.min(1, Math.max(0, rel.confidence || 0.5)),
          reasoningBrief: rel.reasoningBrief.substring(0, 200),
          fromMeeting: fromItem.meeting,
          toMeeting: toItem.meeting,
          inferredAt: new Date().toISOString(),
        };
      })
      .filter((rel): rel is InferredRelationship => rel !== null);
  } catch (error) {
    logger.error(
      `Error parsing inference response: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}

/**
 * Infer relationships between KMS items using Claude
 */
export async function inferRelationships(store: KMSStore): Promise<InferredRelationship[]> {
  try {
    logger.info("Starting relationship inference");

    const data = extractItemsForInference(store);
    const totalItems = data.decisions.length + data.actions.length + data.commitments.length + data.risks.length;

    if (totalItems === 0) {
      logger.info("No KMS items found for relationship inference");
      return [];
    }

    // Build item map for validation
    const itemMap = new Map<string, { type: string; meeting: string }>();
    data.decisions.forEach((d) => itemMap.set(d.id, { type: "decision", meeting: d.meetingName }));
    data.actions.forEach((a) => itemMap.set(a.id, { type: "action", meeting: a.meetingName }));
    data.commitments.forEach((c) => itemMap.set(c.id, { type: "commitment", meeting: c.meetingName }));
    data.risks.forEach((r) => itemMap.set(r.id, { type: "risk", meeting: r.meetingName }));

    logger.debug(
      `Inferring relationships for ${data.decisions.length} decisions, ${data.actions.length} actions, ${data.commitments.length} commitments, ${data.risks.length} risks`
    );

    const prompt = buildInferencePrompt(data);
    const client = getClient();
    const model = getModel();

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt + "\n\nRESPOND WITH ONLY THE JSON ARRAY. NO ADDITIONAL TEXT.",
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const relationships = parseInferenceResponse(responseText, itemMap);

    logger.info(`Inferred ${relationships.length} relationships`);

    return relationships;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Relationship inference failed: ${errorMsg}`);
    // Return empty array on error instead of throwing - let pipeline continue
    return [];
  }
}
