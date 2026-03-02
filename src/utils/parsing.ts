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
  let cleaned = content
    // Remove patterns that look like prompt instructions
    .replace(/ignore\s+(all\s+)?previous\s+instructions?/gi, "[instruction removed]")
    .replace(/output\s+your\s+(system\s+)?prompt/gi, "[instruction removed]")
    .replace(/forget\s+about\s+(previous\s+)?tasks?/gi, "[instruction removed]")
    // Remove control characters that might be used for injection
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, " ")
    // Limit maximum line length to prevent massive context injections
    .split("\n")
    .map((line) =>
      line.length > 10000
        ? line.substring(0, 10000) + " [truncated]"
        : line
    )
    .join("\n");

  return cleaned;
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
