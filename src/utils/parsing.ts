/**
 * Shared parsing utilities for agent response handling.
 * Centralizes JSON parsing and text extraction to reduce duplication
 * and improve security/reliability across all agents.
 */

/**
 * Safely extract text content from Claude API message response.
 * Handles both string and array-based content blocks.
 */
export function extractTextContent(message: any): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (
    message.content &&
    Array.isArray(message.content) &&
    message.content.length > 0
  ) {
    return message.content[0].text || "";
  }

  return "";
}

/**
 * Safely parse JSON from text with explicit error handling.
 * Uses explicit boundary detection instead of regex to prevent
 * regex-based injection attacks and parsing failures.
 *
 * @param text - Text potentially containing JSON
 * @returns Parsed object of type T, or null if parsing fails
 */
export function parseJSON<T>(text: string): T | null {
  try {
    // Find first '{' and last '}'
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    // Validate boundaries exist and are in correct order
    if (start === -1 || end === -1 || start >= end) {
      return null;
    }

    // Extract and parse JSON
    const jsonString = text.substring(start, end + 1);
    return JSON.parse(jsonString) as T;
  } catch (error) {
    // Silent failure - return null on any parsing error
    // Caller should handle null return value
    return null;
  }
}

/**
 * Parse JSON array from text with explicit error handling.
 * Similar to parseJSON but specifically for arrays.
 *
 * @param text - Text potentially containing JSON array
 * @returns Parsed array of type T[], or null if parsing fails
 */
export function parseJSONArray<T>(text: string): T[] | null {
  try {
    // Find first '[' and last ']'
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    // Validate boundaries exist and are in correct order
    if (start === -1 || end === -1 || start >= end) {
      return null;
    }

    // Extract and parse JSON array
    const jsonString = text.substring(start, end + 1);
    return JSON.parse(jsonString) as T[];
  } catch (error) {
    // Silent failure - return null on any parsing error
    return null;
  }
}

/**
 * Sanitize transcript content to reduce prompt injection risks.
 * Removes common prompt injection patterns and control characters.
 *
 * @param content - Raw transcript content
 * @returns Sanitized content safe for inclusion in prompts
 */
export function sanitizeTranscriptContent(content: string): string {
  const MAX_LINES = 5000;

  let cleaned = content
    // Remove patterns that look like prompt instructions
    .replace(/ignore\s+(all\s+)?previous\s+instructions?/gi, "[instruction removed]")
    .replace(/output\s+your\s+(system\s+)?prompt/gi, "[instruction removed]")
    .replace(/forget\s+about\s+(previous\s+)?tasks?/gi, "[instruction removed]")
    // Additional patterns for structured data context
    .replace(/disregard\s+(?:all\s+)?(?:previous\s+)?instructions?/gi, "[instruction removed]")
    .replace(/new\s+instructions?\s*:/gi, "[instruction removed]:")
    .replace(/you\s+(?:must|should|will)\s+(?:now\s+)?(?:ignore|forget|override)/gi, "[instruction removed]")
    // Remove control characters that might be used for injection
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, " ")
    // Limit maximum line length to prevent massive context injections
    .split("\n")
    .map((line) =>
      line.length > 10000
        ? line.substring(0, 10000) + " [truncated]"
        : line
    )
    // Limit total line count to prevent unbounded expansion
    .slice(0, MAX_LINES)
    .join("\n");

  // If truncated due to line limit, add indicator
  if (content.split("\n").length > MAX_LINES) {
    cleaned += `\n\n[truncated: ${content.split("\n").length - MAX_LINES} lines removed]`;
  }

  return cleaned;
}

/**
 * Stricter sanitization for AI-generated data being re-embedded in prompts.
 * Applies all sanitizeTranscriptContent rules plus additional patterns for structured data.
 *
 * @param text - AI-generated or user-controlled text
 * @returns Sanitized content safe for embedding in subsequent prompts
 */
export function sanitizeStructuredData(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }
  return sanitizeTranscriptContent(text);
}

/**
 * Parse YAML frontmatter from markdown file
 * Expected format: ---\nkey: value\n---\n
 *
 * @param content - Full markdown content with frontmatter
 * @returns Parsed frontmatter as object, or null if not found
 */
export function parseFrontmatter(content: string): Record<string, any> | null {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatterText = match[1];
  const frontmatter: Record<string, any> = {};

  // Parse simple YAML lines (key: value format)
  frontmatterText.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      // Handle comma-separated values as arrays
      if (value.includes(",")) {
        frontmatter[key] = value.split(",").map((v) => v.trim());
      } else {
        frontmatter[key] = value;
      }
    }
  });

  return frontmatter;
}

/**
 * Extract markdown content (without frontmatter)
 * @param content - Full markdown content with frontmatter
 * @returns Markdown content without frontmatter
 */
export function extractMarkdownContent(content: string): string {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  return content.replace(frontmatterRegex, "").trim();
}

/**
 * Schema validation for KMS Decision items
 * Validates type safety, enum constraints, and truncates oversized fields
 */
export function validateKMSDecision(raw: unknown): {
  id: string;
  text: string;
  owner: string | null;
  relatedTopics: string[];
  status: string;
} | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as any;
  const validStatuses = ["pending", "in-progress", "completed"];

  // Validate required fields
  if (typeof obj.id !== "string" || !obj.id) return null;
  if (typeof obj.text !== "string" || !obj.text) return null;

  // Validate optional fields
  const owner = obj.owner === null || obj.owner === undefined ? null : String(obj.owner);
  const status = validStatuses.includes(obj.status) ? obj.status : "pending";
  const relatedTopics = Array.isArray(obj.relatedTopics)
    ? obj.relatedTopics.filter((t: any) => typeof t === "string").slice(0, 10)
    : [];

  return {
    id: obj.id.substring(0, 50),
    text: obj.text.substring(0, 500),
    owner: owner ? owner.substring(0, 100) : null,
    relatedTopics: relatedTopics.map((t: string) => t.substring(0, 100)),
    status,
  };
}

/**
 * Schema validation for KMS ActionItem
 */
export function validateKMSActionItem(raw: unknown): {
  id: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  status: string;
  blockers: string[];
} | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as any;
  const validStatuses = ["not-started", "in-progress", "blocked", "completed"];

  // Validate required fields
  if (typeof obj.id !== "string" || !obj.id) return null;
  if (typeof obj.text !== "string" || !obj.text) return null;

  // Validate optional fields
  const owner = obj.owner === null || obj.owner === undefined ? null : String(obj.owner);
  const dueDate =
    obj.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(obj.dueDate))
      ? obj.dueDate
      : null;
  const status = validStatuses.includes(obj.status) ? obj.status : "not-started";
  const blockers = Array.isArray(obj.blockers)
    ? obj.blockers.filter((b: any) => typeof b === "string").slice(0, 10)
    : [];

  return {
    id: obj.id.substring(0, 50),
    text: obj.text.substring(0, 500),
    owner: owner ? owner.substring(0, 100) : null,
    dueDate,
    status,
    blockers: blockers.map((b: string) => b.substring(0, 100)),
  };
}

/**
 * Schema validation for KMS Commitment
 */
export function validateKMSCommitment(raw: unknown): {
  id: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  status: string;
} | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as any;
  const validStatuses = ["pending", "in-progress", "completed"];

  // Validate required fields
  if (typeof obj.id !== "string" || !obj.id) return null;
  if (typeof obj.text !== "string" || !obj.text) return null;

  // Validate optional fields
  const owner = obj.owner === null || obj.owner === undefined ? null : String(obj.owner);
  const dueDate =
    obj.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(String(obj.dueDate))
      ? obj.dueDate
      : null;
  const status = validStatuses.includes(obj.status) ? obj.status : "pending";

  return {
    id: obj.id.substring(0, 50),
    text: obj.text.substring(0, 500),
    owner: owner ? owner.substring(0, 100) : null,
    dueDate,
    status,
  };
}

/**
 * Schema validation for KMS Risk
 */
export function validateKMSRisk(raw: unknown): {
  id: string;
  text: string;
  severity: string;
  mitigation: string | null;
} | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as any;
  const validSeverities = ["low", "medium", "high", "critical"];

  // Validate required fields
  if (typeof obj.id !== "string" || !obj.id) return null;
  if (typeof obj.text !== "string" || !obj.text) return null;

  // Validate optional fields
  const severity = validSeverities.includes(obj.severity)
    ? obj.severity
    : "medium";
  const mitigation =
    obj.mitigation === null || obj.mitigation === undefined
      ? null
      : String(obj.mitigation);

  return {
    id: obj.id.substring(0, 50),
    text: obj.text.substring(0, 500),
    severity,
    mitigation: mitigation ? mitigation.substring(0, 500) : null,
  };
}

/**
 * Schema validation for StrategicRecommendation
 */
export function validateStrategicRecommendation(raw: unknown): {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  estimated_impact: string;
} | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as any;
  const validPriorities = ["high", "medium", "low"];

  // Validate required fields
  if (typeof obj.title !== "string" || !obj.title) return null;
  if (typeof obj.description !== "string" || !obj.description) return null;

  const priority = validPriorities.includes(obj.priority) ? obj.priority : "medium";
  const rationale =
    typeof obj.rationale === "string" ? obj.rationale : "";
  // Handle both expected_impact and estimated_impact fields
  const estimated_impact =
    typeof obj.estimated_impact === "string"
      ? obj.estimated_impact
      : typeof obj.expected_impact === "string"
      ? obj.expected_impact
      : "";

  return {
    title: obj.title.substring(0, 200),
    description: obj.description.substring(0, 1000),
    priority: priority as "high" | "medium" | "low",
    rationale: rationale.substring(0, 500),
    estimated_impact: estimated_impact.substring(0, 500),
  };
}

/**
 * Schema validation for TimelineItem
 */
export function validateTimelineItem(raw: unknown): {
  phase: number;
  description: string;
  duration: string;
  dependencies: string[];
  owner?: string;
} | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const obj = raw as any;

  // Validate required fields - handle both new API format and old format
  const phase = typeof obj.phase === "number" ? obj.phase : 1;
  const description =
    typeof obj.description === "string"
      ? obj.description
      : typeof obj.initiative === "string"
      ? obj.initiative
      : "";
  const duration =
    typeof obj.duration === "string"
      ? obj.duration
      : typeof obj.suggested_timeline === "string"
      ? obj.suggested_timeline
      : "";

  if (!description || !duration) return null;

  const dependencies = Array.isArray(obj.dependencies)
    ? obj.dependencies
        .filter((d: any) => typeof d === "string")
        .slice(0, 10)
        .map((d: string) => d.substring(0, 100))
    : [];

  const owner =
    typeof obj.owner === "string" ? obj.owner.substring(0, 100) : undefined;

  return {
    phase,
    description: description.substring(0, 500),
    duration: duration.substring(0, 100),
    dependencies,
    owner,
  };
}
