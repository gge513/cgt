/**
 * Integration Tests
 * Tests full pipeline: conversion -> analysis -> reporting
 * Tests cross-module interactions and edge cases
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ManifestManager } from "../conversion/manifest";
import { extractMetadata, createMarkdownContent, generateOutputFilename } from "../conversion/metadata";
import { validateFile, validateDirectory, validateApiKey } from "../utils/validation";

describe("Integration Tests", () => {
  let tempDir: string;
  let outputDir: string;
  let manifestManager: ManifestManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "integration-test-"));
    outputDir = path.join(tempDir, "output");
    fs.mkdirSync(outputDir, { recursive: true });
    manifestManager = new ManifestManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe("Full Conversion Pipeline", () => {
    test("should process simple transcript file end-to-end", async () => {
      const inputFile = path.join(tempDir, "meeting.txt");
      const transcriptContent = "Meeting on 2025-01-15 about quarterly planning and goals";
      fs.writeFileSync(inputFile, transcriptContent);

      // Validate input
      const validation = validateFile(inputFile);
      expect(validation.valid).toBe(true);

      // Extract metadata
      const metadata = await extractMetadata(transcriptContent);
      expect(metadata.date).toBeDefined();
      expect(metadata.concepts).toBeDefined();

      // Create markdown
      const markdown = createMarkdownContent(transcriptContent, metadata);
      expect(markdown).toContain("---");
      expect(markdown).toContain("# Meeting Transcript");
      expect(markdown).toContain(transcriptContent);

      // Generate filename
      const outputFilename = generateOutputFilename("meeting.txt", metadata.date);
      expect(outputFilename).toMatch(/\d{4}-\d{2}-\d{2}_meeting\.md|meeting\.md/);

      // Write output
      const outputPath = path.join(outputDir, outputFilename);
      fs.writeFileSync(outputPath, markdown);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Record in manifest
      const manifest = manifestManager.loadManifest();
      const fileHash = manifestManager.computeFileHash(inputFile);
      manifestManager.recordConversion(manifest, "meeting.txt", outputFilename, fileHash!);
      manifestManager.saveManifest(manifest);

      // Verify manifest persistence
      const loadedManifest = manifestManager.loadManifest();
      expect(loadedManifest.processed_files).toHaveLength(1);
      expect(loadedManifest.processed_files[0].output_file).toBe(outputFilename);
    });

    test("should detect when file needs reconversion after modification", async () => {
      const inputFile = path.join(tempDir, "meeting.txt");
      const initialContent = "Initial meeting notes";
      fs.writeFileSync(inputFile, initialContent);

      // First conversion
      const manifest = manifestManager.loadManifest();
      const initialHash = manifestManager.computeFileHash(inputFile);
      manifestManager.recordConversion(manifest, "meeting.txt", "2025-01-15_meeting.md", initialHash!);

      // Verify no reconversion needed
      let needed = manifestManager.isConversionNeeded(inputFile, manifest);
      expect(needed).toBe(false);

      // Modify file
      fs.writeFileSync(inputFile, "Modified meeting notes with new content");

      // Verify reconversion is needed
      needed = manifestManager.isConversionNeeded(inputFile, manifest);
      expect(needed).toBe(true);
    });

    test("should skip analysis if already cached for same model", async () => {
      const manifest = manifestManager.loadManifest();
      const model = "claude-haiku-4-5-20251001";
      const outputFile = "2025-01-15_meeting.md";

      // Record conversion
      manifestManager.recordConversion(manifest, "meeting.txt", outputFile, "hash123");

      // First analysis
      let analysisNeeded = manifestManager.isAnalysisNeeded(outputFile, model, manifest);
      expect(analysisNeeded).toBe(true);

      // Record analysis
      manifestManager.recordAnalysis(manifest, outputFile, model, "report_haiku.md");

      // Second analysis should be cached
      analysisNeeded = manifestManager.isAnalysisNeeded(outputFile, model, manifest);
      expect(analysisNeeded).toBe(false);

      // Different model should need analysis
      const opusModel = "claude-opus-4-6";
      analysisNeeded = manifestManager.isAnalysisNeeded(outputFile, opusModel, manifest);
      expect(analysisNeeded).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    test("should handle very large transcript content gracefully", async () => {
      // Create large content (simulating transcript that exceeds max truncate length)
      // MAX_TRUNCATE_LENGTH is 12000, so create something larger
      const largeContent = "Meeting discussion about quarterly goals and strategic planning. ".repeat(500);
      expect(largeContent.length).toBeGreaterThan(12000);

      // Should not throw error when extracting metadata
      const metadata = await extractMetadata(largeContent);
      expect(metadata).toBeDefined();
      expect(metadata.date).toBeDefined();
    });

    test("should handle empty or whitespace-only transcripts", async () => {
      // Empty content
      let metadata = await extractMetadata("");
      expect(metadata.date).toBe("Unknown");
      expect(metadata.concepts).toEqual([]);

      // Whitespace only
      metadata = await extractMetadata("   \n\n  \t  ");
      expect(metadata.date).toBe("Unknown");
      expect(metadata.concepts).toEqual([]);
    });

    test("should handle transcript with minimal content", async () => {
      const minimalContent = "Meeting";
      const metadata = await extractMetadata(minimalContent);
      expect(metadata).toBeDefined();
      expect(metadata.concepts).toBeDefined();
    });

    test("should handle filenames with special characters", () => {
      const specialFilenames = [
        "meeting (2025-01-15).txt",
        "meeting [final].txt",
        "meeting_2025-01-15.txt",
        "2025-01-15 meeting.txt",
      ];

      specialFilenames.forEach((filename) => {
        const outputName = generateOutputFilename(filename, "2025-01-15");
        expect(outputName).toMatch(/\.md$/);
        expect(outputName).not.toContain(".txt");
      });
    });

    test("should handle multiple files in batch with different states", async () => {
      const files = [
        { name: "file1.txt", content: "Meeting 1" },
        { name: "file2.txt", content: "Meeting 2" },
        { name: "file3.txt", content: "Meeting 3" },
      ];

      const manifest = manifestManager.loadManifest();

      // Process first two files
      for (let i = 0; i < 2; i++) {
        const file = files[i];
        const filePath = path.join(tempDir, file.name);
        fs.writeFileSync(filePath, file.content);
        const hash = manifestManager.computeFileHash(filePath);
        manifestManager.recordConversion(manifest, file.name, `2025-01-15_${file.name.replace(".txt", ".md")}`, hash!);
      }

      // Verify correct state
      expect(manifestManager.isConversionNeeded(path.join(tempDir, files[0].name), manifest)).toBe(false);
      expect(manifestManager.isConversionNeeded(path.join(tempDir, files[1].name), manifest)).toBe(false);
      expect(manifestManager.isConversionNeeded(path.join(tempDir, files[2].name), manifest)).toBe(true);
    });
  });

  describe("Directory and File Validation", () => {
    test("should validate and create output directory structure", () => {
      const nestedDir = path.join(tempDir, "output", "reports", "2025-01");
      let validation = validateDirectory(nestedDir);
      expect(validation.valid).toBe(false);

      // Create directory
      fs.mkdirSync(nestedDir, { recursive: true });
      validation = validateDirectory(nestedDir);
      expect(validation.valid).toBe(true);

      // Verify writable
      validation = validateDirectory(nestedDir, true);
      expect(validation.valid).toBe(true);
    });

    test("should handle permission denied scenarios gracefully", () => {
      const readOnlyDir = path.join(tempDir, "readonly");
      fs.mkdirSync(readOnlyDir);

      try {
        // Change to read-only
        fs.chmodSync(readOnlyDir, 0o444);

        // Try to validate as writable
        const validation = validateDirectory(readOnlyDir, true);

        // Some systems may not enforce this, so we check if error is reported
        if (validation.valid === false) {
          expect(validation.error).toContain("not writable");
        }
      } finally {
        // Restore permissions for cleanup
        fs.chmodSync(readOnlyDir, 0o755);
      }
    });
  });

  describe("Manifest State Management", () => {
    test("should maintain state across save and load cycles", () => {
      const manifest = manifestManager.loadManifest();
      const model1 = "claude-haiku-4-5-20251001";
      const model2 = "claude-opus-4-6";

      // Record conversion
      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");

      // Record analyses with different models
      manifestManager.recordAnalysis(manifest, "2025-01-01_test.md", model1, "report_haiku.md");
      manifestManager.recordAnalysis(manifest, "2025-01-01_test.md", model2, "report_opus.md");

      // Save manifest
      manifestManager.saveManifest(manifest);

      // Load fresh and verify state persists
      const reloaded = manifestManager.loadManifest();
      expect(reloaded.processed_files).toHaveLength(1);
      expect(Object.keys(reloaded.processed_files[0].analyses)).toHaveLength(2);
      expect(reloaded.processed_files[0].analyses[model1]).toBeDefined();
      expect(reloaded.processed_files[0].analyses[model2]).toBeDefined();
    });

    test("should handle force clear scenarios correctly", () => {
      const manifest = manifestManager.loadManifest();

      // Add conversions and analyses
      manifestManager.recordConversion(manifest, "test1.txt", "2025-01-01_test1.md", "hash1");
      manifestManager.recordConversion(manifest, "test2.txt", "2025-01-01_test2.md", "hash2");
      manifestManager.recordAnalysis(manifest, "2025-01-01_test1.md", "claude-haiku-4-5-20251001", "report1.md");
      manifestManager.recordAnalysis(manifest, "2025-01-01_test2.md", "claude-haiku-4-5-20251001", "report2.md");

      // Clear analysis cache only
      manifestManager.clearAnalysisCache(manifest);

      // Conversions should remain, analyses should be cleared
      expect(manifest.processed_files).toHaveLength(2);
      expect(manifest.processed_files[0].analyses).toEqual({});
      expect(manifest.processed_files[1].analyses).toEqual({});

      // Now clear entire manifest
      manifestManager.clearManifest();
      const cleared = manifestManager.loadManifest();
      expect(cleared.processed_files).toEqual([]);
    });
  });

  describe("Markdown Generation", () => {
    test("should create properly formatted markdown with frontmatter", async () => {
      const content = "Important discussion about Q1 strategy";
      const metadata = await extractMetadata(content);

      const markdown = createMarkdownContent(content, metadata);

      // Check frontmatter
      expect(markdown).toMatch(/^---\ndate: .+\nconcepts: .+\n---/);

      // Check heading
      expect(markdown).toContain("# Meeting Transcript");

      // Check content
      expect(markdown).toContain(content);

      // Verify it's valid YAML frontmatter parseable structure
      const parts = markdown.split("---");
      expect(parts.length).toBe(3); // [empty, frontmatter, content]
    });

    test("should handle special characters and formatting in content", () => {
      const specialContent = `
        Meeting notes with special chars: @#$%^&*()
        Code example: const x = 5;
        Links: https://example.com
        Email: test@example.com
      `;

      const metadata = { date: "2025-01-15", concepts: ["meeting", "code"] };
      const markdown = createMarkdownContent(specialContent, metadata);

      expect(markdown).toContain(specialContent.trim());
    });
  });

  describe("Error Recovery", () => {
    test("should recover from corrupted manifest gracefully", () => {
      const manifestPath = path.join(tempDir, ".processed_manifest.json");

      // Write corrupted data
      fs.writeFileSync(manifestPath, "{ invalid json ]}", "utf-8");

      // Should not throw, should regenerate
      const manifest = manifestManager.loadManifest();
      expect(manifest).toBeDefined();
      expect(manifest.processed_files).toEqual([]);
      expect(manifest.version).toBe(1);
    });

    test("should handle missing .anthropic_apikey gracefully in validation", () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;

      try {
        delete process.env.ANTHROPIC_API_KEY;

        const validation = validateApiKey();
        expect(validation.valid).toBe(false);
        expect(validation.error).toContain("not set");
      } finally {
        process.env.ANTHROPIC_API_KEY = originalEnv;
      }
    });

    test("should handle files that disappear between processing stages", async () => {
      const tempFile = path.join(tempDir, "temp.txt");
      fs.writeFileSync(tempFile, "temporary content");

      // Get initial hash
      const hash = manifestManager.computeFileHash(tempFile);
      expect(hash).toBeDefined();

      // Delete file
      fs.unlinkSync(tempFile);

      // Try to hash again
      const missingHash = manifestManager.computeFileHash(tempFile);
      expect(missingHash).toBeNull();
    });
  });
});
