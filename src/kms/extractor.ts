/**
 * KMS Data Extractor
 * Extracts structured decisions, actions, risks, and commitments from analysis reports
 */

import { getClient, getModel } from "../utils/client";
import { getLogger } from "../utils/logging";
import {
  KMSData,
  KMSDecision,
  KMSActionItem,
  KMSCommitment,
  KMSRisk,
} from "../types";
import {
  sanitizeTranscriptContent,
  validateKMSDecision,
  validateKMSActionItem,
  validateKMSCommitment,
  validateKMSRisk,
} from "../utils/parsing";

const logger = getLogger();

/**
 * Extract KMS data from analysis report using Claude
 */
export async function extractKMSData(
  analysisReport: string,
  meetingName: string,
  meetingDate: string
): Promise<KMSData> {
  try {
    const client = getClient();
    const model = getModel();

    const prompt = `You are extracting structured knowledge management data from a strategic analysis report.

Extract and return ONLY valid JSON with these exact fields:
{
  "decisions": [
    {
      "id": "DEC001",
      "text": "Decision description",
      "owner": "Person name or null",
      "relatedTopics": ["topic1", "topic2"],
      "status": "pending"
    }
  ],
  "actionItems": [
    {
      "id": "ACT001",
      "text": "Action description",
      "owner": "Person name or null",
      "dueDate": "YYYY-MM-DD or null",
      "status": "not-started",
      "blockers": []
    }
  ],
  "commitments": [
    {
      "id": "COM001",
      "text": "Commitment text",
      "owner": "Person name or null",
      "dueDate": "YYYY-MM-DD or null",
      "status": "pending"
    }
  ],
  "risks": [
    {
      "id": "RISK001",
      "text": "Risk description",
      "severity": "high",
      "mitigation": "Mitigation strategy or null"
    }
  ]
}

ANALYSIS REPORT:
${sanitizeTranscriptContent(analysisReport)}

Requirements:
- Extract 3-5 key decisions with clear ownership
- Extract 3-5 concrete action items (not generic recommendations)
- Extract 2-3 explicit commitments made
- Extract 2-4 significant risks identified
- Use person names from the report, or null if not specified
- For dates, use YYYY-MM-DD format if mentioned, else null
- IDs should be: DEC001, DEC002... ACT001, ACT002... COM001... RISK001...
- Status values: decisions="pending"|"in-progress"|"completed", actions="not-started"|"in-progress"|"blocked"|"completed", commitments="pending"|"in-progress"|"completed"
- Keep text descriptions concise but complete (20-100 words)
- Return ONLY the JSON, no markdown or other text`;

    const response = await (client as any).messages.create({
      model,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (!responseText) {
      logger.warn("Empty KMS extraction response");
      return createEmptyKMSData(meetingName, meetingDate, model);
    }

    // Parse JSON from response
    const extractedData = parseKMSResponse(responseText);

    return {
      meeting: meetingName,
      analyzedAt: new Date().toISOString(),
      date: meetingDate,
      model,
      decisions: extractedData.decisions || [],
      actionItems: extractedData.actionItems || [],
      commitments: extractedData.commitments || [],
      risks: extractedData.risks || [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to extract KMS data: ${message}`);
    return createEmptyKMSData(meetingName, meetingDate, getModel());
  }
}

/**
 * Parse KMS response from Claude
 * Validates all items against schema to prevent injection attacks
 */
function parseKMSResponse(text: string): {
  decisions: KMSDecision[];
  actionItems: KMSActionItem[];
  commitments: KMSCommitment[];
  risks: KMSRisk[];
} {
  try {
    // Try direct parsing
    let data = JSON.parse(text);

    // Validate and filter all items
    const validatedDecisions = (data.decisions || [])
      .map(validateKMSDecision)
      .filter((d: any) => d !== null) as KMSDecision[];
    const validatedActions = (data.actionItems || [])
      .map(validateKMSActionItem)
      .filter((a: any) => a !== null) as KMSActionItem[];
    const validatedCommitments = (data.commitments || [])
      .map(validateKMSCommitment)
      .filter((c: any) => c !== null) as KMSCommitment[];
    const validatedRisks = (data.risks || [])
      .map(validateKMSRisk)
      .filter((r: any) => r !== null) as KMSRisk[];

    return {
      decisions: validatedDecisions,
      actionItems: validatedActions,
      commitments: validatedCommitments,
      risks: validatedRisks,
    };
  } catch {
    // Try extracting JSON from markdown code blocks
    const blockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (blockMatch) {
      try {
        let data = JSON.parse(blockMatch[1]);

        // Validate and filter all items
        const validatedDecisions = (data.decisions || [])
          .map(validateKMSDecision)
          .filter((d: any) => d !== null) as KMSDecision[];
        const validatedActions = (data.actionItems || [])
          .map(validateKMSActionItem)
          .filter((a: any) => a !== null) as KMSActionItem[];
        const validatedCommitments = (data.commitments || [])
          .map(validateKMSCommitment)
          .filter((c: any) => c !== null) as KMSCommitment[];
        const validatedRisks = (data.risks || [])
          .map(validateKMSRisk)
          .filter((r: any) => r !== null) as KMSRisk[];

        return {
          decisions: validatedDecisions,
          actionItems: validatedActions,
          commitments: validatedCommitments,
          risks: validatedRisks,
        };
      } catch {
        // Continue
      }
    }
  }

  logger.warn("Could not parse KMS response, returning empty data");
  return {
    decisions: [],
    actionItems: [],
    commitments: [],
    risks: [],
  };
}

/**
 * Create empty KMS data structure
 */
function createEmptyKMSData(
  meetingName: string,
  meetingDate: string,
  model: string
): KMSData {
  return {
    meeting: meetingName,
    analyzedAt: new Date().toISOString(),
    date: meetingDate,
    model,
    decisions: [],
    actionItems: [],
    commitments: [],
    risks: [],
  };
}
