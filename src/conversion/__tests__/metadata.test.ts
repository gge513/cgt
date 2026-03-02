/**
 * Metadata Extraction Tests
 * Tests JSON parsing, frontmatter generation, and filename generation
 */

import {
  extractJsonFromResponse,
  createMarkdownContent,
  generateOutputFilename,
} from "../metadata";
import { TranscriptMetadata } from "../../types";

describe("Metadata Extraction", () => {
  describe("extractJsonFromResponse", () => {
    test("should parse valid JSON directly", () => {
      const jsonText = '{"date": "2025-01-01", "concepts": ["test", "demo"]}';
      const result = extractJsonFromResponse(jsonText);

      expect(result.date).toBe("2025-01-01");
      expect(result.concepts).toEqual(["test", "demo"]);
    });

    test("should parse JSON from markdown code block", () => {
      const jsonText = `
Some text before
\`\`\`json
{"date": "2025-01-15", "concepts": ["planning", "strategy"]}
\`\`\`
Some text after
      `;
      const result = extractJsonFromResponse(jsonText);

      expect(result.date).toBe("2025-01-15");
      expect(result.concepts).toEqual(["planning", "strategy"]);
    });

    test("should parse JSON from generic code block", () => {
      const jsonText = `
\`\`\`
{"date": "2025-02-01", "concepts": ["analysis"]}
\`\`\`
      `;
      const result = extractJsonFromResponse(jsonText);

      expect(result.date).toBe("2025-02-01");
    });

    test("should handle JSON embedded in text", () => {
      const jsonText =
        "Based on analysis: {\"date\": \"2025-03-01\", \"concepts\": [\"review\"]}";
      const result = extractJsonFromResponse(jsonText);

      expect(result.date).toBe("2025-03-01");
    });

    test("should throw error for invalid JSON", () => {
      const invalidJson = "This is not JSON at all";

      expect(() => {
        extractJsonFromResponse(invalidJson);
      }).toThrow("No valid JSON found");
    });

    test("should handle malformed JSON in brackets", () => {
      const malformed = "{invalid: json with no quotes}";

      expect(() => {
        extractJsonFromResponse(malformed);
      }).toThrow();
    });
  });

  describe("createMarkdownContent", () => {
    test("should create valid markdown with frontmatter", () => {
      const content = "Meeting discussion about quarterly planning";
      const metadata: TranscriptMetadata = {
        date: "2025-01-15",
        concepts: ["planning", "quarterly", "goals"],
      };

      const markdown = createMarkdownContent(content, metadata);

      expect(markdown).toContain("---");
      expect(markdown).toContain('date: 2025-01-15');
      expect(markdown).toContain("concepts: planning, quarterly, goals");
      expect(markdown).toContain("# Meeting Transcript");
      expect(markdown).toContain(content);
    });

    test("should handle empty concepts gracefully", () => {
      const content = "Some transcript";
      const metadata: TranscriptMetadata = {
        date: "2025-01-01",
        concepts: [],
      };

      const markdown = createMarkdownContent(content, metadata);

      expect(markdown).toContain("concepts: No concepts detected");
    });

    test("should handle unknown date", () => {
      const content = "Transcript without date";
      const metadata: TranscriptMetadata = {
        date: "Unknown",
        concepts: ["topic"],
      };

      const markdown = createMarkdownContent(content, metadata);

      expect(markdown).toContain("date: Unknown");
    });

    test("should preserve special characters in content", () => {
      const content = "Content with special chars: @#$%^&*(){}[]|\\:;<>?,./";
      const metadata: TranscriptMetadata = {
        date: "2025-01-01",
        concepts: ["special"],
      };

      const markdown = createMarkdownContent(content, metadata);

      expect(markdown).toContain(content);
    });
  });

  describe("generateOutputFilename", () => {
    test("should generate filename with date prefix", () => {
      const filename = generateOutputFilename("meeting.txt", "2025-01-15");

      expect(filename).toBe("2025-01-15_meeting.md");
    });

    test("should remove .txt extension from input", () => {
      const filename = generateOutputFilename("transcript.txt", "2025-02-20");

      expect(filename).toBe("2025-02-20_transcript.md");
    });

    test("should remove .md extension from input if present", () => {
      const filename = generateOutputFilename("already.md", "2025-03-01");

      expect(filename).toBe("2025-03-01_already.md");
    });

    test("should handle Unknown date", () => {
      const filename = generateOutputFilename("meeting.txt", "Unknown");

      expect(filename).toBe("meeting.md");
    });

    test("should handle empty date", () => {
      const filename = generateOutputFilename("meeting.txt", "");

      expect(filename).toBe("meeting.md");
    });

    test("should preserve filename components", () => {
      const filename = generateOutputFilename("team_meeting_2025.txt", "2025-01-10");

      expect(filename).toBe("2025-01-10_team_meeting_2025.md");
    });
  });
});
