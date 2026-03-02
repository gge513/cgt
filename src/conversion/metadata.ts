/**
 * Metadata extraction from transcript content
 * Uses Claude API to extract meeting date and key concepts
 */

import { getClient, getModel } from "../utils/client";
import { TranscriptMetadata } from "../types";
import { getLogger } from "../utils/logging";

const logger = getLogger();
const MAX_RETRIES = 3;
const MAX_TRUNCATE_LENGTH = 12000;
const RETRY_DELAY_MS = 1000; // Exponential backoff starting at 1 second

/**
 * Extract JSON from Claude response
 * Handles plain JSON, markdown code blocks, and nested objects
 */
export function extractJsonFromResponse(text: string): Record<string, any> {
  // Try direct parsing first
  try {
    return JSON.parse(text);
  } catch {
    // Continue to other strategies
  }

  // Try markdown code blocks
  const blockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (blockMatch) {
    try {
      return JSON.parse(blockMatch[1]);
    } catch {
      // Continue
    }
  }

  // Try to find JSON object in the text
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // Continue
    }
  }

  throw new Error(`No valid JSON found in response: ${text.substring(0, 200)}`);
}

/**
 * Extract meeting date and concepts from transcript content
 * Uses Claude API with retry logic
 */
export async function extractMetadata(
  content: string,
  retryCount: number = 0
): Promise<TranscriptMetadata> {
  try {
    // Truncate very long transcripts to avoid context limits
    let transcriptContent = content;
    if (content.length > MAX_TRUNCATE_LENGTH) {
      transcriptContent = content.substring(0, MAX_TRUNCATE_LENGTH) + "\n\n[transcript truncated...]";
      logger.debug(`Truncated content from ${content.length} to ${transcriptContent.length} chars`);
    }

    const client = getClient();
    const model = getModel();

    // Use type assertion to access messages.create
    const messageResponse = await (client as any).messages.create({
      model,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Analyze this meeting transcript and extract:
1. The meeting date (in YYYY-MM-DD format if possible, or the best date reference found)
2. Key concepts, topics, and themes discussed (as a list of 5-10 relevant tags)

Respond ONLY in this exact JSON format, no other text:
{
    "date": "YYYY-MM-DD or best date reference",
    "concepts": ["concept1", "concept2", "concept3"]
}

TRANSCRIPT:
${transcriptContent}`,
        },
      ],
    });

    // Extract text from response
    const responseText =
      messageResponse.content[0].type === "text" ? messageResponse.content[0].text : "";

    if (!responseText || !responseText.trim()) {
      if (retryCount < MAX_RETRIES) {
        logger.debug(`Empty response, retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await delay(RETRY_DELAY_MS * Math.pow(2, retryCount)); // Exponential backoff
        return extractMetadata(content, retryCount + 1);
      }
      logger.warn("API returned empty response after retries");
      return { date: "Unknown", concepts: [] };
    }

    // Parse JSON from response
    const metadata = extractJsonFromResponse(responseText);
    const date = metadata.date || "Unknown";
    let concepts: string[] = metadata.concepts || [];

    // Validate concepts is an array
    if (!Array.isArray(concepts)) {
      concepts = [];
    }

    logger.debug(`Extracted metadata: date=${date}, concepts=[${concepts.join(", ")}]`);
    return { date, concepts };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeoutError =
      errorMessage.includes("timeout") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("ECONNRESET");
    const isRateLimitError =
      errorMessage.includes("429") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("too many requests");

    if (retryCount < MAX_RETRIES && (isTimeoutError || isRateLimitError)) {
      const delayMs = RETRY_DELAY_MS * Math.pow(2, retryCount);
      logger.warn(
        `${isRateLimitError ? "Rate limited" : "API timeout"}, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      await delay(delayMs);
      return extractMetadata(content, retryCount + 1);
    }

    logger.warn(`Could not extract metadata after ${MAX_RETRIES} retries: ${errorMessage}`);
    return { date: "Unknown", concepts: [] };
  }
}

/**
 * Create markdown content with YAML frontmatter
 */
export function createMarkdownContent(
  transcriptContent: string,
  metadata: TranscriptMetadata
): string {
  const conceptsStr = metadata.concepts.length > 0
    ? metadata.concepts.join(", ")
    : "No concepts detected";

  return `---
date: ${metadata.date}
concepts: ${conceptsStr}
---

# Meeting Transcript

${transcriptContent}`;
}

/**
 * Generate output filename based on extracted date
 */
export function generateOutputFilename(inputFileName: string, date: string): string {
  const fileBase = inputFileName.replace(/\.txt$/, "").replace(/\.md$/, "");

  if (date && date !== "Unknown") {
    return `${date}_${fileBase}.md`;
  }

  return `${fileBase}.md`;
}

/**
 * Helper function to delay execution (for retry backoff)
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
