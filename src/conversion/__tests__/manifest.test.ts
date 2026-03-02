/**
 * Manifest Manager Tests
 * Tests caching, persistence, and recovery logic
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ManifestManager } from "../manifest";
import { Manifest } from "../../types";

describe("ManifestManager", () => {
  let tempDir: string;
  let manifestManager: ManifestManager;

  beforeEach(() => {
    // Create temporary directory for test manifests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
    manifestManager = new ManifestManager(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe("loadManifest", () => {
    test("should create empty manifest if file does not exist", () => {
      const manifest = manifestManager.loadManifest();

      expect(manifest).toBeDefined();
      expect(manifest.version).toBe(1);
      expect(manifest.processed_files).toEqual([]);
      expect(manifest.last_run).toBeDefined();
    });

    test("should load existing manifest from disk", () => {
      // Create and save a manifest
      const originalManifest: Manifest = {
        version: 1,
        last_run: new Date().toISOString(),
        processed_files: [
          {
            input_file: "test.txt",
            output_file: "2025-01-01_test.md",
            conversions: {
              file_hash: "abc123",
              converted_at: new Date().toISOString(),
              source_file: "test.txt",
              output_file: "2025-01-01_test.md",
            },
            analyses: {},
          },
        ],
      };

      manifestManager.saveManifest(originalManifest);

      // Load and verify
      const loadedManifest = manifestManager.loadManifest();
      expect(loadedManifest.processed_files).toHaveLength(1);
      expect(loadedManifest.processed_files[0].input_file).toBe("test.txt");
    });

    test("should regenerate manifest if file is corrupted", () => {
      const manifestPath = path.join(tempDir, ".processed_manifest.json");

      // Write corrupted JSON
      fs.writeFileSync(manifestPath, "{ invalid json ]}", "utf-8");

      // Should return empty manifest instead of throwing
      const manifest = manifestManager.loadManifest();
      expect(manifest.processed_files).toEqual([]);
    });
  });

  describe("isConversionNeeded", () => {
    test("should return true for new files not in manifest", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "test content");

      const manifest = manifestManager.loadManifest();
      const needed = manifestManager.isConversionNeeded(testFile, manifest);

      expect(needed).toBe(true);
    });

    test("should return false for unchanged files in manifest", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "test content");

      const manifest = manifestManager.loadManifest();
      const fileHash = manifestManager.computeFileHash(testFile);

      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", fileHash!);

      // Check again without changes
      const needed = manifestManager.isConversionNeeded(testFile, manifest);
      expect(needed).toBe(false);
    });

    test("should return true for modified files in manifest", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "original content");

      const manifest = manifestManager.loadManifest();
      const fileHash = manifestManager.computeFileHash(testFile);
      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", fileHash!);

      // Modify file
      fs.writeFileSync(testFile, "modified content");

      // Should need re-conversion
      const needed = manifestManager.isConversionNeeded(testFile, manifest);
      expect(needed).toBe(true);
    });

    test("should return true when force flag is set", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "test content");

      const manifest = manifestManager.loadManifest();
      const fileHash = manifestManager.computeFileHash(testFile);
      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", fileHash!);

      // Even unchanged file should need conversion with force flag
      const needed = manifestManager.isConversionNeeded(testFile, manifest, true);
      expect(needed).toBe(true);
    });
  });

  describe("isAnalysisNeeded", () => {
    test("should return true for files not in manifest", () => {
      const manifest = manifestManager.loadManifest();
      const needed = manifestManager.isAnalysisNeeded(
        "2025-01-01_test.md",
        "claude-haiku-4-5-20251001",
        manifest
      );

      expect(needed).toBe(true);
    });

    test("should return true for different model", () => {
      const manifest = manifestManager.loadManifest();
      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");
      manifestManager.recordAnalysis(
        manifest,
        "2025-01-01_test.md",
        "claude-haiku-4-5-20251001",
        "report.md"
      );

      // Check with different model
      const needed = manifestManager.isAnalysisNeeded(
        "2025-01-01_test.md",
        "claude-opus-4-6",
        manifest
      );
      expect(needed).toBe(true);
    });

    test("should return false for cached analysis with same model", () => {
      const manifest = manifestManager.loadManifest();
      const model = "claude-haiku-4-5-20251001";

      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");
      manifestManager.recordAnalysis(manifest, "2025-01-01_test.md", model, "report.md");

      // Check same model
      const needed = manifestManager.isAnalysisNeeded(
        "2025-01-01_test.md",
        model,
        manifest
      );
      expect(needed).toBe(false);
    });

    test("should return true when force flag is set", () => {
      const manifest = manifestManager.loadManifest();
      const model = "claude-haiku-4-5-20251001";

      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");
      manifestManager.recordAnalysis(manifest, "2025-01-01_test.md", model, "report.md");

      // Force flag should require re-analysis
      const needed = manifestManager.isAnalysisNeeded(
        "2025-01-01_test.md",
        model,
        manifest,
        true
      );
      expect(needed).toBe(true);
    });
  });

  describe("recordConversion", () => {
    test("should add new conversion entry to manifest", () => {
      const manifest = manifestManager.loadManifest();

      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");

      expect(manifest.processed_files).toHaveLength(1);
      expect(manifest.processed_files[0].input_file).toBe("test.txt");
      expect(manifest.processed_files[0].conversions.file_hash).toBe("hash123");
    });

    test("should update existing conversion entry", () => {
      const manifest = manifestManager.loadManifest();

      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");
      expect(manifest.processed_files).toHaveLength(1);

      // Record again with different hash
      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash456");

      expect(manifest.processed_files).toHaveLength(1); // Should update, not add
      expect(manifest.processed_files[0].conversions.file_hash).toBe("hash456");
    });
  });

  describe("recordAnalysis", () => {
    test("should record analysis in existing conversion entry", () => {
      const manifest = manifestManager.loadManifest();
      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");

      manifestManager.recordAnalysis(
        manifest,
        "2025-01-01_test.md",
        "claude-haiku-4-5-20251001",
        "report.md"
      );

      expect(manifest.processed_files[0].analyses["claude-haiku-4-5-20251001"]).toBeDefined();
      expect(
        manifest.processed_files[0].analyses["claude-haiku-4-5-20251001"].report_file
      ).toBe("report.md");
    });

    test("should support multiple models for same file", () => {
      const manifest = manifestManager.loadManifest();
      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");

      manifestManager.recordAnalysis(
        manifest,
        "2025-01-01_test.md",
        "claude-haiku-4-5-20251001",
        "report_haiku.md"
      );
      manifestManager.recordAnalysis(
        manifest,
        "2025-01-01_test.md",
        "claude-opus-4-6",
        "report_opus.md"
      );

      expect(Object.keys(manifest.processed_files[0].analyses)).toHaveLength(2);
      expect(manifest.processed_files[0].analyses["claude-haiku-4-5-20251001"].report_file).toBe(
        "report_haiku.md"
      );
      expect(manifest.processed_files[0].analyses["claude-opus-4-6"].report_file).toBe(
        "report_opus.md"
      );
    });
  });

  describe("clearAnalysisCache", () => {
    test("should clear all analysis entries", () => {
      const manifest = manifestManager.loadManifest();
      manifestManager.recordConversion(manifest, "test1.txt", "2025-01-01_test1.md", "hash1");
      manifestManager.recordConversion(manifest, "test2.txt", "2025-01-01_test2.md", "hash2");

      manifestManager.recordAnalysis(manifest, "2025-01-01_test1.md", "claude-haiku-4-5-20251001", "report1.md");
      manifestManager.recordAnalysis(manifest, "2025-01-01_test2.md", "claude-haiku-4-5-20251001", "report2.md");

      manifestManager.clearAnalysisCache(manifest);

      expect(manifest.processed_files[0].analyses).toEqual({});
      expect(manifest.processed_files[1].analyses).toEqual({});
    });
  });

  describe("computeFileHash", () => {
    test("should compute consistent hash for file content", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "test content");

      const hash1 = manifestManager.computeFileHash(testFile);
      const hash2 = manifestManager.computeFileHash(testFile);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeDefined();
      expect(hash1!.length).toBe(32); // MD5 hash length
    });

    test("should return null for non-existent file", () => {
      const hash = manifestManager.computeFileHash("/non/existent/file.txt");
      expect(hash).toBeNull();
    });

    test("should detect file modifications", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "original content");

      const hash1 = manifestManager.computeFileHash(testFile);

      fs.writeFileSync(testFile, "modified content");
      const hash2 = manifestManager.computeFileHash(testFile);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("saveManifest", () => {
    test("should persist manifest to disk", () => {
      const manifest = manifestManager.loadManifest();
      manifestManager.recordConversion(manifest, "test.txt", "2025-01-01_test.md", "hash123");

      manifestManager.saveManifest(manifest);

      // Load again and verify
      const loaded = manifestManager.loadManifest();
      expect(loaded.processed_files).toHaveLength(1);
      expect(loaded.processed_files[0].input_file).toBe("test.txt");
    });

    test("should update last_run timestamp", () => {
      const manifest = manifestManager.loadManifest();
      const originalTime = manifest.last_run;

      // Small delay to ensure timestamp changes
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      return delay(10).then(() => {
        manifestManager.saveManifest(manifest);
        const reloaded = manifestManager.loadManifest();

        expect(reloaded.last_run).not.toBe(originalTime);
      });
    });
  });
});
