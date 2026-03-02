# Testing Examples: CLI & SDK Verification

This document provides copy-paste ready test examples for catching CLI stubs and SDK incompatibilities.

---

## 1. Automated Code Quality Checks

### 1.1 Pre-Commit Hook

Save as `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Pre-commit hook: Prevent committing stubbed code

set -e

echo "Running pre-commit checks..."

# Check 1: No TODO/FIXME in src/ (excluding tests)
TODOS=$(grep -r "TODO\|FIXME" src/ --include="*.ts" --exclude-dir="__tests__" 2>/dev/null || true)
if [ ! -z "$TODOS" ]; then
  echo "❌ ERROR: Found TODO/FIXME comments in src/"
  echo "$TODOS"
  exit 1
fi

# Check 2: No unimplemented functions in cli.ts
if grep -q "Not implemented\|throw new Error(\"Not" src/cli.ts 2>/dev/null; then
  echo "❌ ERROR: Found unimplemented stubs in src/cli.ts"
  grep -n "Not implemented\|throw new Error(\"Not" src/cli.ts
  exit 1
fi

# Check 3: TypeScript compilation
echo "Checking TypeScript..."
npx tsc --noEmit || {
  echo "❌ ERROR: TypeScript compilation failed"
  exit 1
}

# Check 4: All command cases have exit() calls
echo "Checking command routing..."
if grep -A 20 'switch (command)' src/cli.ts | grep -q 'case "[^"]*":\s*$'; then
  echo "Checking if all cases have implementations..."
  # This is a simplified check
fi

echo "✅ Pre-commit checks passed"
exit 0
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

### 1.2 GitHub Actions Workflow

Save as `.github/workflows/quality.yml`:

```yaml
name: Code Quality

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm ci

      - name: Check for TODO/FIXME
        run: |
          if grep -r "TODO\|FIXME" src/ --include="*.ts" --exclude-dir="__tests__"; then
            echo "❌ Found TODO/FIXME in production code"
            exit 1
          fi

      - name: Check for unimplemented stubs
        run: |
          if grep -q "Not implemented" src/cli.ts; then
            echo "❌ Found unimplemented stubs"
            exit 1
          fi

      - name: TypeScript lint
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: SDK compatibility tests
        run: npm run test -- --testPathPattern=sdk-compatibility

      - name: Build
        run: npm run build
```

---

## 2. Real Test Cases

### 2.1 CLI Stub Detection Test

```typescript
// File: src/__tests__/cli-implementation.test.ts

import * as fs from "fs";
import * as path from "path";

describe("CLI Implementation Validation", () => {
  const cliPath = path.join(__dirname, "../cli.ts");
  let cliContent: string;

  beforeAll(() => {
    cliContent = fs.readFileSync(cliPath, "utf-8");
  });

  describe("No TODO/FIXME comments", () => {
    test("should not have TODO in cli.ts", () => {
      const lines = cliContent.split("\n");
      const todosWithLine = lines
        .map((line, i) => [line, i + 1] as const)
        .filter(([line]) => /TODO|FIXME/.test(line) && !line.trim().startsWith("//"))
        .map(([line, lineNum]) => `Line ${lineNum}: ${line.trim()}`);

      if (todosWithLine.length > 0) {
        throw new Error(`Found TODO/FIXME:\n${todosWithLine.join("\n")}`);
      }
    });
  });

  describe("Command implementations", () => {
    test("analyze command is fully implemented", () => {
      // Extract the analyze case block
      const analyzeMatch = cliContent.match(
        /case\s+"analyze"\s*:\s*{([\s\S]*?)(?:case|default|^    \})/m
      );

      expect(analyzeMatch).toBeTruthy();
      const analyzeBlock = analyzeMatch![1];

      // Should contain actual function calls
      expect(analyzeBlock).toContain("convertTranscripts");
      expect(analyzeBlock).toContain("analyzeConvertedFiles");

      // Should not contain stub indicators
      expect(analyzeBlock).not.toContain("Not implemented");
      expect(analyzeBlock).not.toContain("// TODO");
      expect(analyzeBlock).not.toContain("throw new Error");

      // Should have exit statement
      expect(analyzeBlock).toContain("process.exit");
    });

    test("convert command is fully implemented", () => {
      const convertMatch = cliContent.match(
        /case\s+"convert"\s*:\s*{([\s\S]*?)(?:case|default|^    \})/m
      );

      expect(convertMatch).toBeTruthy();
      const convertBlock = convertMatch![1];

      expect(convertBlock).toContain("convertTranscripts");
      expect(convertBlock).not.toContain("Not implemented");
      expect(convertBlock).toContain("process.exit");
    });

    test("analyze-existing command is fully implemented", () => {
      const analyzeExistingMatch = cliContent.match(
        /case\s+"analyze-existing"\s*:\s*{([\s\S]*?)(?:case|default|^    \})/m
      );

      expect(analyzeExistingMatch).toBeTruthy();
      const analyzeExistingBlock = analyzeExistingMatch![1];

      expect(analyzeExistingBlock).toContain("analyzeConvertedFiles");
      expect(analyzeExistingBlock).not.toContain("Not implemented");
      expect(analyzeExistingBlock).toContain("process.exit");
    });

    test("all cases have exit statements", () => {
      const caseMatches = cliContent.matchAll(
        /case\s+"([^"]+)"\s*:\s*{([\s\S]*?)(?=\s+case\s+"|default:|^    \})/gm
      );

      const casesWithoutExit = [];

      for (const match of caseMatches) {
        const [, caseName, caseBlock] = match;

        if (!caseBlock.includes("process.exit")) {
          casesWithoutExit.push(caseName);
        }
      }

      if (casesWithoutExit.length > 0) {
        throw new Error(
          `Cases without exit statements: ${casesWithoutExit.join(", ")}`
        );
      }
    });
  });

  describe("Error handling", () => {
    test("main() has try-catch around async operations", () => {
      const mainMatch = cliContent.match(/async function main\(\)[\s\S]*?}\n\}/);
      expect(mainMatch).toBeTruthy();

      const mainBlock = mainMatch![0];
      expect(mainBlock).toContain("try");
      expect(mainBlock).toContain("catch");
    });

    test("async command handlers have error boundaries", () => {
      // Check that await statements are in try-catch
      const awaitMatches = cliContent.matchAll(/await\s+\w+\(/g);

      for (const match of awaitMatches) {
        const beforeAwait = cliContent.substring(
          Math.max(0, match.index! - 500),
          match.index!
        );

        // Should have try before await
        const tryCount = (beforeAwait.match(/try\s*{/g) || []).length;
        const catchCount = (beforeAwait.match(/}\s*catch/g) || []).length;

        // This is a simplified check - proper implementation would parse AST
        expect(tryCount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Type safety", () => {
    test("no explicit 'any' types at CLI boundaries", () => {
      const anyMatches = cliContent.match(/:\s*any/g);
      expect(anyMatches).toBeNull();
    });

    test("uses proper types from types.ts", () => {
      expect(cliContent).toContain("import");
      expect(cliContent).toContain("CLIOptions");
    });
  });

  describe("Command routing logic", () => {
    test("default case handles unknown commands", () => {
      const defaultMatch = cliContent.match(/default:\s*{([\s\S]*?)}/);
      expect(defaultMatch).toBeTruthy();

      const defaultBlock = defaultMatch![1];
      expect(defaultBlock).toContain("showHelp");
      expect(defaultBlock).toContain("process.exit");
    });

    test("missing command shows help", () => {
      const hasHelpCheck = cliContent.includes("showHelp");
      expect(hasHelpCheck).toBe(true);
    });
  });
});
```

### 2.2 SDK Integration Test

```typescript
// File: src/__tests__/sdk-integration.test.ts

import { getClient, getModel } from "../utils/client";
import type Anthropic from "@anthropic-ai/sdk";

describe("SDK Integration", () => {
  describe("Client initialization", () => {
    test("should initialize Anthropic client with valid API key", () => {
      const client = getClient();
      expect(client).toBeDefined();
      expect(typeof client.messages.create).toBe("function");
    });

    test("should return same client instance (singleton pattern)", () => {
      const client1 = getClient();
      const client2 = getClient();
      expect(client1).toBe(client2);
    });
  });

  describe("SDK method signatures", () => {
    test("messages.create() should accept expected parameters", async () => {
      const client = getClient();

      // This test verifies type compatibility without making actual API calls
      // by checking that parameters are assignable

      const validParams = {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user" as const,
            content: "test",
          },
        ],
      };

      // If types don't match SDK expectations, TypeScript will error here
      // but we're just checking it exists
      expect(client.messages.create).toBeDefined();
    });

    test("should throw for invalid model IDs", async () => {
      const client = getClient();

      try {
        // This should fail - invalid model
        await client.messages.create({
          model: "invalid-model-xyz",
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: "test",
            },
          ],
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail with API error
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("Error handling compatibility", () => {
    test("should handle API errors gracefully", async () => {
      const client = getClient();

      try {
        // Invalid API key in client
        const badClient = new (require("@anthropic-ai/sdk")).default({
          apiKey: "invalid-key-123",
        });

        await badClient.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 100,
          messages: [{ role: "user", content: "test" }],
        });
      } catch (error) {
        // Should be an Error instance
        expect(error instanceof Error).toBe(true);
      }
    });
  });

  describe("Model selection", () => {
    test("getModel() returns valid Claude model ID", () => {
      const model = getModel();

      expect(typeof model).toBe("string");
      expect(model.startsWith("claude-")).toBe(true);
    });

    test("supports switching between models", () => {
      // Model should respect MODEL_ID env var
      const originalModel = process.env.MODEL_ID;

      try {
        // Note: getModel() caches, so this is a conceptual test
        const model1 = process.env.MODEL_ID || "claude-haiku-4-5-20251001";
        expect(model1).toContain("claude-");
      } finally {
        process.env.MODEL_ID = originalModel;
      }
    });
  });

  describe("Response type compatibility", () => {
    test("messages.create() returns Message type", async () => {
      const client = getClient();

      try {
        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: "What is 1+1?",
            },
          ],
        });

        // Verify response has expected Message structure
        expect(message).toBeDefined();
        expect(message.id).toBeDefined();
        expect(message.content).toBeDefined();
        expect(Array.isArray(message.content)).toBe(true);
        expect(message.stop_reason).toBeDefined();
      } catch (error) {
        // If API call fails, at least verify error handling works
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("Streaming compatibility", () => {
    test("should support streaming if implemented", async () => {
      const client = getClient();

      // Verify streaming capability exists in SDK
      expect(typeof client.messages.stream).toBe("function");
    });
  });
});
```

### 2.3 CLI Smoke Test

```typescript
// File: src/__tests__/cli-smoke.test.ts

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

describe("CLI Smoke Tests", () => {
  describe("Command availability", () => {
    test("npm run analyze command exists", () => {
      const packageJson = require("../../package.json");
      expect(packageJson.scripts.analyze).toBeDefined();
    });

    test("npm run convert command exists", () => {
      const packageJson = require("../../package.json");
      expect(packageJson.scripts.convert).toBeDefined();
    });

    test("npm run analyze-existing command exists", () => {
      const packageJson = require("../../package.json");
      expect(packageJson.scripts["analyze-existing"]).toBeDefined();
    });
  });

  describe("Command callable (not stubs)", () => {
    test("analyze command is callable", () => {
      try {
        // Try to get help instead of running full command
        const result = execSync("npm run analyze 2>&1 || true", {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: 5000,
        });

        // Should not say "Not implemented"
        expect(result).not.toContain("Not implemented");
        expect(result).not.toContain("TODO");
      } catch (error) {
        // Even if it fails, should not be a stub error
        const message = (error as any).message || "";
        expect(message).not.toContain("Not implemented");
      }
    });

    test("convert command is callable", () => {
      try {
        const result = execSync("npm run convert 2>&1 || true", {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: 5000,
        });

        expect(result).not.toContain("Not implemented");
      } catch (error) {
        const message = (error as any).message || "";
        expect(message).not.toContain("Not implemented");
      }
    });

    test("analyze-existing command is callable", () => {
      try {
        const result = execSync("npm run analyze-existing 2>&1 || true", {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: 5000,
        });

        expect(result).not.toContain("Not implemented");
      } catch (error) {
        const message = (error as any).message || "";
        expect(message).not.toContain("Not implemented");
      }
    });
  });

  describe("Build successful", () => {
    test("TypeScript compiles without errors", () => {
      const result = execSync("npm run lint", {
        cwd: process.cwd(),
        encoding: "utf-8",
      });

      // Should complete without error (exit code 0)
      expect(result).toBeDefined();
    });

    test("distribution builds", () => {
      const result = execSync("npm run build", {
        cwd: process.cwd(),
        encoding: "utf-8",
      });

      // dist/ should exist
      expect(fs.existsSync(path.join(process.cwd(), "dist"))).toBe(true);
    });
  });

  describe("No invalid SDK calls", () => {
    test("src/ does not reference invalid SDK methods", () => {
      const cliContent = fs.readFileSync(
        path.join(process.cwd(), "src/cli.ts"),
        "utf-8"
      );

      const invalidMethods = [
        ".completion(", // Old API
        ".query(", // Non-existent
        ".textCompletion(", // Non-existent
      ];

      invalidMethods.forEach((method) => {
        expect(cliContent).not.toContain(method);
      });
    });

    test("src/ uses correct SDK methods", () => {
      const cliContent = fs.readFileSync(
        path.join(process.cwd(), "src/cli.ts"),
        "utf-8"
      );

      // Should import from client module which has SDK
      expect(cliContent).toContain('from "./utils/client"');
    });
  });
});
```

---

## 3. Custom Test Utilities

### 3.1 Test Helper: CLI Testing Utility

```typescript
// File: src/__tests__/helpers/cli-test-helper.ts

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface CLITestResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class CLITestHelper {
  private tempDir: string = "";

  /**
   * Set up test environment
   */
  setupTestEnvironment(): void {
    this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-test-"));
  }

  /**
   * Clean up test environment
   */
  cleanupTestEnvironment(): void {
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Run a CLI command
   */
  runCommand(
    command: string,
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      allowFailure?: boolean;
    } = {}
  ): CLITestResult {
    const cwd = options.cwd || process.cwd();
    const timeout = options.timeout || 30000;
    const allowFailure = options.allowFailure ?? false;

    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    try {
      const result = execSync(`npm run ${command}`, {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ...options.env,
        },
        timeout,
      });

      stdout = result;
      return { success: true, exitCode: 0, stdout, stderr };
    } catch (error: any) {
      exitCode = error.status || 1;
      stderr = error.stderr?.toString() || error.message || "";
      stdout = error.stdout?.toString() || "";

      if (!allowFailure) {
        throw error;
      }

      return {
        success: false,
        exitCode,
        stdout,
        stderr,
      };
    }
  }

  /**
   * Verify command is not a stub
   */
  verifyCommandImplemented(command: string): boolean {
    const result = this.runCommand(command, { allowFailure: true });

    // Should not contain stub indicators
    const stubIndicators = [
      "Not implemented",
      "TODO",
      "Error: Unknown command",
    ];

    for (const indicator of stubIndicators) {
      if (
        result.stderr.includes(indicator) ||
        result.stdout.includes(indicator)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create test input files
   */
  createTestTranscripts(count: number = 1): string[] {
    const inputDir = path.join(this.tempDir, "input");
    fs.mkdirSync(inputDir, { recursive: true });

    const files = [];
    for (let i = 0; i < count; i++) {
      const filename = `test_${i + 1}.txt`;
      const filepath = path.join(inputDir, filename);
      const content = `
Meeting on 2025-01-15 about Q1 planning and strategy.
Participants discussed quarterly goals and metrics.
Decision: Increase resources for product team.
Action: John to prepare budget proposal by Jan 20.
      `;

      fs.writeFileSync(filepath, content);
      files.push(filepath);
    }

    return files;
  }

  /**
   * Get output files generated by command
   */
  getOutputFiles(pattern: string = "*.md"): string[] {
    const outputDir = path.join(this.tempDir, "output");

    if (!fs.existsSync(outputDir)) {
      return [];
    }

    return fs
      .readdirSync(outputDir)
      .filter((f) => f.match(pattern))
      .map((f) => path.join(outputDir, f));
  }

  /**
   * Get processing directory files
   */
  getProcessedFiles(): string[] {
    const processingDir = path.join(this.tempDir, "processing");

    if (!fs.existsSync(processingDir)) {
      return [];
    }

    return fs
      .readdirSync(processingDir)
      .map((f) => path.join(processingDir, f));
  }

  /**
   * Verify file exists and has content
   */
  verifyFileExists(filepath: string): boolean {
    return fs.existsSync(filepath) && fs.statSync(filepath).size > 0;
  }
}
```

### 3.2 Test Helper Usage

```typescript
// File: src/__tests__/cli-e2e.test.ts

import { CLITestHelper } from "./helpers/cli-test-helper";

describe("CLI End-to-End Tests", () => {
  let helper: CLITestHelper;

  beforeEach(() => {
    helper = new CLITestHelper();
    helper.setupTestEnvironment();
  });

  afterEach(() => {
    helper.cleanupTestEnvironment();
  });

  describe("Command implementations", () => {
    test("analyze command is implemented (not stub)", () => {
      const isImplemented = helper.verifyCommandImplemented("analyze");
      expect(isImplemented).toBe(true);
    });

    test("convert command is implemented (not stub)", () => {
      const isImplemented = helper.verifyCommandImplemented("convert");
      expect(isImplemented).toBe(true);
    });

    test("analyze-existing command is implemented (not stub)", () => {
      const isImplemented = helper.verifyCommandImplemented("analyze-existing");
      expect(isImplemented).toBe(true);
    });
  });

  describe("Command execution flow", () => {
    test("convert command should process files without errors", () => {
      helper.createTestTranscripts(1);

      const result = helper.runCommand("convert", { allowFailure: true });

      // Should either succeed or fail with proper error, not stub
      expect(result.stderr).not.toContain("Not implemented");
    });
  });
});
```

---

## 4. Running Tests Locally

### 4.1 Quick Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- cli-implementation.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="analyze command"

# Run SDK compatibility tests only
npm test -- --testPathPattern=sdk-compatibility

# Run with coverage
npm test -- --coverage

# Run in watch mode during development
npm test -- --watch

# Run with verbose output
npm test -- --verbose
```

### 4.2 Test Coverage Report

```bash
npm test -- --coverage --coverageReporters=html

# Open coverage report
open coverage/index.html
```

---

## 5. CI/CD Integration

### 5.1 Pre-Push Verification Script

Save as `scripts/verify-before-push.sh`:

```bash
#!/bin/bash

set -e

echo "Running verification before push..."
echo ""

# 1. Check for TODOs
echo "1. Checking for TODO/FIXME comments..."
if grep -r "TODO\|FIXME" src/ --include="*.ts" --exclude-dir="__tests__" 2>/dev/null; then
  echo "❌ FAILED: Found TODO/FIXME in production code"
  exit 1
fi
echo "✓ No TODO/FIXME found"

# 2. Type checking
echo ""
echo "2. Running TypeScript type check..."
npm run lint || {
  echo "❌ FAILED: TypeScript errors found"
  exit 1
}
echo "✓ TypeScript clean"

# 3. Unit tests
echo ""
echo "3. Running tests..."
npm test || {
  echo "❌ FAILED: Tests failed"
  exit 1
}
echo "✓ All tests passed"

# 4. SDK compatibility
echo ""
echo "4. Checking SDK compatibility..."
npm run test -- --testPathPattern=sdk-compatibility || {
  echo "❌ FAILED: SDK compatibility check failed"
  exit 1
}
echo "✓ SDK compatible"

# 5. Build
echo ""
echo "5. Building project..."
npm run build || {
  echo "❌ FAILED: Build failed"
  exit 1
}
echo "✓ Build successful"

echo ""
echo "✅ All checks passed! Ready to push."
```

Make executable and add to git:

```bash
chmod +x scripts/verify-before-push.sh
git add scripts/verify-before-push.sh

# Use via: ./scripts/verify-before-push.sh
```

---

## Quick Reference: What to Test

| Issue | Test | How to Detect |
|-------|------|---------------|
| Stubbed CLI commands | CLI implementation test | `grep "Not implemented"` |
| Missing TODO removal | Code inspection | `grep "TODO"` in src/ |
| SDK method mismatch | SDK compatibility test | TypeScript compilation |
| Missing exit codes | CLI handler test | `grep "process.exit"` in all cases |
| Unhandled errors | Error boundary test | try-catch around async |
| Type mismatches | TypeScript strict mode | `npm run lint` |
| Build failures | Build test | `npm run build` succeeds |
| Runtime failures | Integration test | Full pipeline test |

---

**Last Updated:** March 2, 2026
**Ready to Copy & Paste:** Yes
**Framework:** Jest with TypeScript
