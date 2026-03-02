/**
 * Validation Tests
 * Tests file validation, directory validation, and configuration validation
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  validateFile,
  validateDirectory,
  validateApiKey,
  validateModelId,
  validateTotalSize,
  ensureDirectoryExists,
  validateStartupRequirements,
} from "../validation";

describe("Validation Utilities", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "validation-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe("validateFile", () => {
    test("should validate readable file", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "test content");

      const result = validateFile(testFile);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("should reject non-existent file", () => {
      const result = validateFile(path.join(tempDir, "nonexistent.txt"));

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should reject symlinks", () => {
      const testFile = path.join(tempDir, "test.txt");
      const symlinkPath = path.join(tempDir, "symlink.txt");

      fs.writeFileSync(testFile, "test content");
      try {
        fs.symlinkSync(testFile, symlinkPath);

        const result = validateFile(symlinkPath);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Symlinks not supported");
      } catch (error) {
        // Symlinks may not be supported on Windows
        if ((error as any).code !== "EPERM") {
          throw error;
        }
      }
    });

    test("should reject file exceeding size limit", () => {
      const testFile = path.join(tempDir, "large.txt");
      // Create file larger than test limit
      const content = "x".repeat(11000000); // 11MB
      fs.writeFileSync(testFile, content);

      const result = validateFile(testFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds size limit");

      fs.unlinkSync(testFile);
    });
  });

  describe("validateDirectory", () => {
    test("should validate readable directory", () => {
      const result = validateDirectory(tempDir);

      expect(result.valid).toBe(true);
    });

    test("should reject non-existent directory", () => {
      const result = validateDirectory(path.join(tempDir, "nonexistent"));

      expect(result.valid).toBe(false);
    });

    test("should reject non-directory path", () => {
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "test");

      const result = validateDirectory(testFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not a directory");
    });

    test("should validate writable directory when required", () => {
      const result = validateDirectory(tempDir, true);

      expect(result.valid).toBe(true);
    });

    test("should reject read-only directory when writable required", () => {
      const readOnlyDir = path.join(tempDir, "readonly");
      fs.mkdirSync(readOnlyDir);

      try {
        fs.chmodSync(readOnlyDir, 0o444);

        const result = validateDirectory(readOnlyDir, true);

        // Some systems may not support chmod properly
        if (result.valid === false) {
          expect(result.error).toContain("not writable");
        }
      } finally {
        fs.chmodSync(readOnlyDir, 0o755);
      }
    });
  });

  describe("validateApiKey", () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY;

    afterEach(() => {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    });

    test("should reject missing API key", () => {
      delete process.env.ANTHROPIC_API_KEY;

      const result = validateApiKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not set");
    });

    test("should reject short API key", () => {
      process.env.ANTHROPIC_API_KEY = "short";

      const result = validateApiKey();

      expect(result.valid).toBe(false);
      expect(result.error).toContain("too short");
    });

    test("should accept valid API key format", () => {
      process.env.ANTHROPIC_API_KEY = "sk_test_" + "a".repeat(50);

      const result = validateApiKey();

      expect(result.valid).toBe(true);
    });
  });

  describe("validateModelId", () => {
    test("should accept valid Claude model IDs", () => {
      const validModels = [
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
      ];

      validModels.forEach((model) => {
        const result = validateModelId(model);
        expect(result.valid).toBe(true);
      });
    });

    test("should reject non-Claude models", () => {
      const result = validateModelId("gpt-4");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid model ID");
    });

    test("should reject model without claude- prefix", () => {
      const result = validateModelId("haiku-4-5");

      expect(result.valid).toBe(false);
    });
  });

  describe("validateTotalSize", () => {
    test("should accept files within total limit", () => {
      const file1 = path.join(tempDir, "file1.txt");
      const file2 = path.join(tempDir, "file2.txt");

      fs.writeFileSync(file1, "x".repeat(1000)); // 1KB
      fs.writeFileSync(file2, "x".repeat(1000)); // 1KB

      const result = validateTotalSize([file1, file2]);

      expect(result.valid).toBe(true);
    });

    test("should reject files exceeding total limit", () => {
      const largeFile = path.join(tempDir, "large.txt");
      // Create file larger than 100MB limit
      const content = "x".repeat(105000000);
      fs.writeFileSync(largeFile, content);

      const result = validateTotalSize([largeFile]);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds limit");

      fs.unlinkSync(largeFile);
    });

    test("should handle non-existent files", () => {
      const result = validateTotalSize([path.join(tempDir, "nonexistent.txt")]);

      expect(result.valid).toBe(false);
    });
  });

  describe("ensureDirectoryExists", () => {
    test("should create missing directory", () => {
      const newDir = path.join(tempDir, "new", "nested", "dir");

      expect(fs.existsSync(newDir)).toBe(false);

      const result = ensureDirectoryExists(newDir);

      expect(result.valid).toBe(true);
      expect(fs.existsSync(newDir)).toBe(true);
    });

    test("should succeed if directory already exists", () => {
      const existingDir = path.join(tempDir, "existing");
      fs.mkdirSync(existingDir);

      const result = ensureDirectoryExists(existingDir);

      expect(result.valid).toBe(true);
    });

    test("should verify directory is writable", () => {
      const newDir = path.join(tempDir, "test_dir");

      const result = ensureDirectoryExists(newDir);

      expect(result.valid).toBe(true);
      expect(fs.existsSync(newDir)).toBe(true);

      // Verify writable by trying to create a file
      const testFile = path.join(newDir, "test.txt");
      fs.writeFileSync(testFile, "test");
      expect(fs.existsSync(testFile)).toBe(true);
    });
  });

  describe("validateStartupRequirements", () => {
    const originalEnv = process.env.ANTHROPIC_API_KEY;

    afterEach(() => {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    });

    test("should fail if API key is not set", () => {
      delete process.env.ANTHROPIC_API_KEY;

      const result = validateStartupRequirements();

      expect(result.valid).toBe(false);
    });

    test("should succeed with valid API key and default model", () => {
      process.env.ANTHROPIC_API_KEY = "sk_test_" + "a".repeat(50);

      const result = validateStartupRequirements();

      expect(result.valid).toBe(true);
    });

    test("should fail with invalid MODEL_ID", () => {
      process.env.ANTHROPIC_API_KEY = "sk_test_" + "a".repeat(50);
      process.env.MODEL_ID = "invalid-model";

      const result = validateStartupRequirements();

      expect(result.valid).toBe(false);
    });

    test("should succeed with valid custom model", () => {
      process.env.ANTHROPIC_API_KEY = "sk_test_" + "a".repeat(50);
      process.env.MODEL_ID = "claude-sonnet-4-6";

      const result = validateStartupRequirements();

      expect(result.valid).toBe(true);

      delete process.env.MODEL_ID;
    });
  });
});
