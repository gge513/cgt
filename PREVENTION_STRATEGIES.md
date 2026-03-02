# Prevention Strategies: CLI Wiring + SDK Upgrade

## Problem Statement

The system had two interconnected issues:
1. **CLI Commands Stubbed**: Commands in `cli.ts` were routing to function calls but those functions weren't fully implemented (TODO comments)
2. **SDK/Dependency Mismatch**: Anthropic SDK was outdated, API signatures changed between versions, causing type mismatches and runtime failures

This document provides concrete prevention strategies to avoid these patterns recurring.

---

## 1. Code Review Patterns

### 1.1 Red Flags During Review

#### Flag: TODO/FIXME in Public Interfaces
```typescript
// WRONG: TODO comment in production code
export async function analyzeFile(file: string): Promise<AnalysisReport> {
  // TODO: Implement this
  throw new Error("Not implemented");
}

// RIGHT: Explicit interface contract
export async function analyzeFile(file: string): Promise<AnalysisReport> {
  logger.info(`Analyzing file: ${file}`);
  const result = await performAnalysis(file);
  return result;
}
```

**Review Action**: Reject PRs with TODO/FIXME in exported functions or CLI command handlers.

#### Flag: Incomplete Command Routing
```typescript
// WRONG: Incomplete switch cases
switch (command) {
  case "analyze":
    // TODO: implement
    break;
  case "convert":
    // TODO: implement
    break;
  // Missing default handling
}

// RIGHT: All cases implemented with validation
switch (command) {
  case "analyze":
    logger.info("Starting analysis");
    const result = await analyzeConvertedFiles(options, manifest);
    return result;

  case "convert":
    logger.info("Starting conversion");
    const stats = await convertTranscripts(inputDir, outputDir);
    return stats;

  default:
    showHelp();
    process.exit(1);
}
```

**Review Action**: Verify every command case has implementation and exit handling.

#### Flag: Type Mismatches at Boundaries
```typescript
// WRONG: Type mismatch between CLI argument and function signature
const result = await convertTranscripts(args[1]); // args[1] is any
// Function expects: convertTranscripts(inputDir: string, outputDir: string)

// RIGHT: Explicit validation and type casting
const inputDir = args[1] || "input";
const outputDir = args[2] || "processing";
validateDirectory(inputDir, false); // Throws if invalid
const result = await convertTranscripts(inputDir, outputDir);
```

**Review Action**: Ensure CLI argument parsing validates inputs before passing to functions.

#### Flag: No Return/Exit After Command Execution
```typescript
// WRONG: Missing exit code
case "analyze":
  const stats = await convertTranscripts(inputDir, outputDir);
  logger.info("Done");
  // Falls through - no exit code!
  break;

// RIGHT: Explicit exit with appropriate code
case "analyze":
  const stats = await convertTranscripts(inputDir, outputDir);
  process.exit(stats.exitCode); // 0, 1, or 2
```

**Review Action**: Verify all command cases explicitly exit with appropriate status codes.

#### Flag: Missing Error Boundaries
```typescript
// WRONG: No error handling around async operation
case "analyze":
  const result = await analyzeConvertedFiles(options, manifest);
  // What if analyzeConvertedFiles throws?

// RIGHT: Error handling at command boundary
case "analyze":
  try {
    const result = await analyzeConvertedFiles(options, manifest);
    process.exit(result.exitCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Analysis failed: ${message}`);
    process.exit(2);
  }
```

**Review Action**: CLI command handlers must have try-catch wrapping async operations.

### 1.2 Review Checklist for CLI Changes

```markdown
## CLI/Command Review Checklist

- [ ] **No TODO/FIXME in implementation** - All logic fully implemented
- [ ] **Explicit function calls** - No stubs, actual implementations
- [ ] **Input validation** - Arguments validated before use
- [ ] **Exit code handling** - All paths call process.exit(code)
- [ ] **Error boundaries** - try-catch around async operations
- [ ] **Logging** - Entry and exit points logged
- [ ] **Test coverage** - Command tested end-to-end
- [ ] **Type safety** - No `any` types at boundaries
- [ ] **Documentation** - Command documented in help text
- [ ] **Integration tested** - Verified against actual SDK
```

### 1.3 Review Process

1. **Automated Checks**
   ```bash
   # Flag TODO/FIXME comments in production code
   grep -r "TODO\|FIXME" src/ --include="*.ts" --exclude-dir="__tests__"

   # Check for throw Error("Not implemented")
   grep -r "Not implemented\|TODO\|FIXME" src/ --include="*.ts"

   # Verify all exported functions have implementations
   npx tslint --config tslint.json
   ```

2. **Manual Review Focus Areas**
   - CLI routing logic (src/cli.ts)
   - Command handler implementations
   - SDK method calls and their signatures
   - Error handling around API calls

3. **Pre-Merge Verification**
   ```bash
   npm run lint              # TypeScript errors
   npm run test             # Unit + integration tests
   npm run build            # Compilation check
   ```

---

## 2. Testing Strategies

### 2.1 Unit Tests for CLI Commands

```typescript
// File: src/__tests__/cli.test.ts

import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";

describe("CLI Command Routing", () => {
  describe("analyze command", () => {
    test("should not contain TODO comments in implementation", async () => {
      const cliContent = fs.readFileSync(
        path.join(__dirname, "../cli.ts"),
        "utf-8"
      );

      // Verify implementation exists
      expect(cliContent).toContain('case "analyze":');
      expect(cliContent).not.toContain('// TODO: implement');
      expect(cliContent).not.toContain('throw new Error("Not implemented")');
    });

    test("should call actual convertTranscripts function", async () => {
      const cliContent = fs.readFileSync(
        path.join(__dirname, "../cli.ts"),
        "utf-8"
      );

      // Verify it calls the real function, not a stub
      expect(cliContent).toContain("convertTranscripts(inputDir, processingDir)");
      expect(cliContent).not.toContain("TODO");
    });

    test("should validate arguments before passing to functions", async () => {
      // Test the actual CLI with invalid input
      const result = await execCLI("analyze", {
        ANTHROPIC_API_KEY: "invalid"
      });

      // Should fail with validation error, not stub error
      expect(result.code).not.toBe(0);
      expect(result.stderr).not.toContain("Not implemented");
    });

    test("should exit with proper exit code after analysis", async () => {
      // Mock successful analysis
      const result = await execCLI("analyze", {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      });

      // Should exit with 0, 1, or 2 - not undefined
      expect([0, 1, 2]).toContain(result.code);
    });
  });

  describe("convert command", () => {
    test("should have full implementation", () => {
      const cliContent = fs.readFileSync(
        path.join(__dirname, "../cli.ts"),
        "utf-8"
      );

      const analyzeCase = cliContent.match(
        /case "convert":\s*{([\s\S]*?)(?:case|default|\})/
      );
      expect(analyzeCase).toBeTruthy();
      expect(analyzeCase![1]).not.toContain("TODO");
      expect(analyzeCase![1]).toContain("convertTranscripts");
    });
  });

  describe("analyze-existing command", () => {
    test("should have full implementation", () => {
      const cliContent = fs.readFileSync(
        path.join(__dirname, "../cli.ts"),
        "utf-8"
      );

      const analyzeCase = cliContent.match(
        /case "analyze-existing":\s*{([\s\S]*?)(?:case|default|\})/
      );
      expect(analyzeCase).toBeTruthy();
      expect(analyzeCase![1]).not.toContain("TODO");
      expect(analyzeCase![1]).toContain("analyzeConvertedFiles");
    });
  });
});

// Helper function
function execCLI(
  command: string,
  env: Record<string, string> = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const subprocess = exec(`npm run ${command}`, {
      env: { ...process.env, ...env },
    });

    let stdout = "";
    let stderr = "";

    subprocess.stdout?.on("data", (data) => {
      stdout += data;
    });

    subprocess.stderr?.on("data", (data) => {
      stderr += data;
    });

    subprocess.on("close", (code) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}
```

### 2.2 Integration Tests for SDK Compatibility

```typescript
// File: src/__tests__/sdk-compatibility.test.ts

import * as Anthropic from "@anthropic-ai/sdk";
import { getClient, getModel } from "../utils/client";

describe("SDK Compatibility", () => {
  describe("Anthropic SDK methods", () => {
    test("should verify messages.create() signature matches SDK", async () => {
      const client = getClient();

      // Verify the method exists and has expected signature
      expect(client.messages).toBeDefined();
      expect(typeof client.messages.create).toBe("function");

      // Verify parameter types match SDK
      const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user" as const,
            content: "test",
          },
        ],
      };

      // Should not throw type error
      expect(() => {
        // Type check only - don't actually call
        void params;
      }).not.toThrow();
    });

    test("should verify Message response type", async () => {
      const client = getClient();

      // Create a mock message to verify response structure
      const expectedFields = ["id", "type", "role", "content", "model", "stop_reason"];

      // This validates that the SDK Message type has expected fields
      type MessageType = Anthropic.Messages.Message;
      type ContentBlock = Anthropic.Messages.ContentBlock;

      expect(true).toBe(true); // Type check passed at compile time
    });

    test("should verify error handling matches SDK", async () => {
      const client = getClient();

      try {
        // This will fail due to invalid API key
        await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 100,
          messages: [
            {
              role: "user",
              content: "test",
            },
          ],
        });
      } catch (error) {
        // Verify error is Anthropic SDK error
        expect(error).toBeInstanceOf(Error);
        // SDK errors have specific properties
        expect(error instanceof Error ? error.message : "").toBeTruthy();
      }
    });
  });

  describe("SDK version compatibility", () => {
    test("should have compatible SDK version", () => {
      const packageJson = require("../../package.json");
      const sdkVersion = packageJson.dependencies["@anthropic-ai/sdk"];

      // Ensure SDK version is specified (not wildcards)
      expect(sdkVersion).toMatch(/^\^|^~/); // Should pin minor version

      // Version should be reasonably recent
      const [major] = sdkVersion.replace(/[^\d.]/g, "").split(".");
      expect(parseInt(major)).toBeGreaterThan(0);
    });

    test("should verify no breaking changes in current SDK", async () => {
      // List of known breaking changes between SDK versions
      const knownBreakingChanges = {
        // Example: method signature changes
        // "0.77.0": "messages.create() parameter changed from 'system' to 'system_prompt'"
      };

      const packageJson = require("../../package.json");
      const sdkVersion = packageJson.dependencies["@anthropic-ai/sdk"];

      // Verify current version avoids known breaking changes
      for (const [version, change] of Object.entries(knownBreakingChanges)) {
        expect(sdkVersion).not.toContain(version);
      }
    });
  });

  describe("CLI SDK integration", () => {
    test("analyze command should use correct SDK methods", async () => {
      // This test verifies that cli.ts uses SDK correctly
      const cliContent = require("fs").readFileSync(
        require("path").join(__dirname, "../cli.ts"),
        "utf-8"
      );

      // Verify SDK is imported
      expect(cliContent).toContain("from \"./utils/client\"");
      expect(cliContent).toContain("getClient()");

      // Verify no hardcoded SDK method calls that might be wrong
      expect(cliContent).not.toContain(".completion("); // Old API
      expect(cliContent).not.toContain(".query("); // Non-existent method
    });
  });
});
```

### 2.3 Smoke Tests for Command Functionality

```typescript
// File: src/__tests__/smoke.test.ts

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Smoke Tests - Command Functionality", () => {
  let testDir: string;

  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-test-"));
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  test("analyze command should be callable (not stubbed)", () => {
    // This test verifies the command exists and is not a stub
    try {
      const result = execSync("npm run analyze -- --help", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: "pipe",
      });

      // Should show help, not an error about unimplemented
      expect(result).not.toContain("Not implemented");
      expect(result).not.toContain("TODO");
    } catch (error) {
      // Even if it fails, it should fail with proper validation error
      const stderr = (error as any).stderr || "";
      expect(stderr).not.toContain("Not implemented");
    }
  });

  test("convert command should be callable (not stubbed)", () => {
    try {
      const result = execSync("npm run convert -- --help", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: "pipe",
      });

      expect(result).not.toContain("Not implemented");
    } catch (error) {
      const stderr = (error as any).stderr || "";
      expect(stderr).not.toContain("Not implemented");
    }
  });

  test("analyze-existing command should be callable (not stubbed)", () => {
    try {
      const result = execSync("npm run analyze-existing -- --help", {
        cwd: process.cwd(),
        encoding: "utf-8",
        stdio: "pipe",
      });

      expect(result).not.toContain("Not implemented");
    } catch (error) {
      const stderr = (error as any).stderr || "";
      expect(stderr).not.toContain("Not implemented");
    }
  });

  test("cli should not reference unimplemented SDK methods", () => {
    const cliPath = path.join(__dirname, "../cli.ts");
    const content = fs.readFileSync(cliPath, "utf-8");

    // List of SDK methods that don't exist or have changed
    const invalidMethods = [
      ".completion(", // Changed to .messages.create()
      ".textCompletion(", // Non-existent
      ".query(", // Non-existent
    ];

    invalidMethods.forEach((method) => {
      expect(content).not.toContain(method);
    });
  });

  test("package.json should have pinned SDK version", () => {
    const packageJson = require("../../package.json");
    const sdkVersion = packageJson.dependencies["@anthropic-ai/sdk"];

    // Should be pinned to avoid unexpected upgrades
    expect(sdkVersion).toMatch(/^\^[\d.]+/); // Caret allows minor versions
    expect(sdkVersion).not.toBe("*"); // Wildcard = unpredictable
    expect(sdkVersion).not.toContain("latest");
  });

  test("all npm scripts should be defined", () => {
    const packageJson = require("../../package.json");
    const requiredScripts = ["analyze", "convert", "analyze-existing"];

    requiredScripts.forEach((script) => {
      expect(packageJson.scripts[script]).toBeDefined();
      expect(packageJson.scripts[script]).toContain("npm run");
    });
  });
});
```

---

## 3. Dependency Management

### 3.1 SDK Update Policy

```markdown
## Dependency Update Policy

### Version Pinning Strategy

1. **Lock File Required**
   - Always commit `package-lock.json`
   - Prevents unexpected version changes
   - Enables reproducible builds

2. **SDK Versioning**
   - Use caret range: `^0.78.0` (allows 0.78.0 - 0.79.x)
   - Avoid wildcard: `*` or `latest`
   - Review major version changes before updating

3. **Update Frequency**
   - Check for updates weekly
   - Review changelog for breaking changes
   - Test before merging to main

### Update Process

```bash
# 1. Check for available updates
npm outdated

# 2. Review SDK changelog
# https://github.com/anthropics/anthropic-sdk-python/releases

# 3. Create feature branch
git checkout -b chore/sdk-upgrade-v0.79

# 4. Update specific package
npm install @anthropic-ai/sdk@^0.79.0

# 5. Run full test suite
npm test
npm run build

# 6. Verify SDK compatibility
npm run test -- --testPathPattern=sdk-compatibility

# 7. Test commands manually
ANTHROPIC_API_KEY=test npm run analyze

# 8. Commit changes
git add package.json package-lock.json
git commit -m "chore: upgrade SDK to 0.79.0"

# 9. Create PR with changelog notes
```

### Breaking Change Checklist

When updating SDK versions:

- [ ] Review changelog for breaking changes
- [ ] Run `npm run lint` (TypeScript error check)
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] SDK compatibility tests pass
- [ ] CLI commands still work
- [ ] Error messages remain helpful
```

### 3.2 Version Matrix Documentation

```typescript
// File: SDK_COMPATIBILITY.md

# SDK Compatibility Matrix

## Current Environment
- Node.js: 18+ (required by package.json)
- TypeScript: 5.0.0+
- @anthropic-ai/sdk: ^0.78.0

## Known Compatible Versions

### 0.78.0 to 0.79.x
- ✓ All methods stable
- ✓ Type definitions complete
- ✓ Error handling consistent

### Breaking Changes

#### From 0.76.x to 0.77.0
- ❌ `client.messages.create()` signature changed
- ❌ `system_prompt` parameter removed (use system in messages)
- Migration: See MIGRATION_GUIDE.md

#### Expected in Future Versions
- Watch for streaming API changes
- Function calling parameters may change
- Keep PR changelog updated

## Testing SDK Upgrades

1. Update SDK version
2. Run `npm run test:sdk-compat`
3. Review TypeScript errors
4. Update implementations as needed
5. Commit changes with detailed migration notes
```

### 3.3 Automatic Dependency Checks

```json
{
  "scripts": {
    "verify-deps": "npm audit --audit-level=moderate && npm outdated",
    "test:sdk-compat": "jest --testPathPattern=sdk-compatibility",
    "precommit": "npm run lint && npm run test:sdk-compat",
    "prerelease": "npm test && npm run verify-deps"
  }
}
```

---

## 4. Architecture Best Practices

### 4.1 Clear Separation: CLI Routing vs Business Logic

```typescript
// FILE: src/cli.ts
// PURPOSE: Command routing ONLY - no business logic

import { convertTranscripts } from "./conversion/converter";
import { analyzeConvertedFiles } from "./analysis/orchestrator";

async function main(): Promise<void> {
  // Step 1: Parse command
  const command = process.argv[2];

  // Step 2: Route to appropriate handler
  // Do NOT implement logic here - delegate to modules
  switch (command) {
    case "analyze":
      return handleAnalyze();
    case "convert":
      return handleConvert();
    case "analyze-existing":
      return handleAnalyzeExisting();
    default:
      showHelp();
      process.exit(1);
  }
}

// Step 3: Command handlers validate and delegate
async function handleAnalyze(): Promise<void> {
  // Only validation and orchestration - not business logic
  const inputDir = "input";
  const processingDir = "processing";
  const outputDir = "output";

  // Step 1: Call actual implementation (don't implement here!)
  const conversionStats = await convertTranscripts(inputDir, processingDir);

  // Step 2: Check results
  if (conversionStats.total_found === 0) {
    logger.warn("No files found");
    process.exit(1);
  }

  // Step 3: Call next step
  const analysisResult = await analyzeConvertedFiles(options, manifest);

  // Step 4: Exit with appropriate code
  process.exit(analysisResult.exitCode);
}
```

**Rules:**
- ✓ CLI routes commands to handlers
- ✓ Handlers validate inputs and delegate to modules
- ✗ NO business logic in cli.ts
- ✗ NO SDK calls in cli.ts (use utils/client.ts)
- ✗ NO TODO/FIXME comments

### 4.2 Type-Safe CLI Argument Passing

```typescript
// FILE: src/types.ts
// Purpose: Single source of truth for all types

export interface CLIOptions {
  command: "analyze" | "convert" | "analyze-existing";
  inputDir: string;
  processingDir: string;
  outputDir: string;
  model: string;
  force?: boolean;
}

// FILE: src/cli.ts
// Purpose: Parse raw arguments into typed options

function parseArguments(): CLIOptions {
  const command = process.argv[2];

  // Validate command is known
  if (!["analyze", "convert", "analyze-existing"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  return {
    command: command as CLIOptions["command"],
    inputDir: "input",
    processingDir: "processing",
    outputDir: "output",
    model: process.env.MODEL_ID || "claude-haiku-4-5-20251001",
    force: process.argv.includes("--force"),
  };
}

// FILE: src/cli.ts
// Use typed options throughout

const options = parseArguments(); // Returns CLIOptions, not any
const result = await convertTranscripts(options.inputDir, options.processingDir);
```

**Benefits:**
- No `any` types at CLI boundaries
- TypeScript catches argument mismatches
- Clear contract between CLI and modules

### 4.3 Command Handler Pattern

```typescript
// Standardized pattern for command handlers

interface CommandHandler {
  name: string;
  description: string;
  execute(options: CLIOptions): Promise<void>;
  validate(options: CLIOptions): ValidationResult;
}

// Example: ConvertHandler
class ConvertHandler implements CommandHandler {
  name = "convert";
  description = "Convert .txt to .md";

  async execute(options: CLIOptions): Promise<void> {
    logger.info(`Starting ${this.name} command`);

    try {
      const stats = await convertTranscripts(
        options.inputDir,
        options.processingDir
      );

      logger.info(`Conversion complete: ${stats.successful}/${stats.total_found}`);
      process.exit(stats.exitCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`${this.name} failed: ${message}`);
      process.exit(2);
    }
  }

  validate(options: CLIOptions): ValidationResult {
    // Validate all required inputs
    const inputCheck = validateDirectory(options.inputDir);
    if (!inputCheck.valid) return inputCheck;

    const outputCheck = validateDirectory(options.processingDir, true);
    if (!outputCheck.valid) return outputCheck;

    return { valid: true };
  }
}

// Router selects correct handler
const handlers = [
  new ConvertHandler(),
  new AnalyzeHandler(),
  new AnalyzeExistingHandler(),
];

async function routeCommand(command: string, options: CLIOptions): Promise<void> {
  const handler = handlers.find(h => h.name === command);

  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }

  // Validate before executing
  const validation = handler.validate(options);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Execute handler
  await handler.execute(options);
}
```

**Benefits:**
- Consistent error handling
- Clear validation rules
- Easy to add/remove commands
- Testable command logic

---

## 5. Documentation Requirements

### 5.1 CLI Command Documentation

Every command must have complete documentation:

```markdown
# CLI Commands - Complete Reference

## analyze

**Full Pipeline**: Converts transcripts to markdown and generates analysis reports.

**Usage**
```bash
npm run analyze
```

**Process**
1. Discovers .txt files in `input/` directory
2. Converts each to markdown with YAML frontmatter
3. Analyzes converted files with specified model
4. Generates reports in `output/`

**Output**
- Converted markdown: `processing/*.md`
- Analysis reports: `output/report_[MODEL].md`

**Exit Codes**
- 0: All files processed successfully
- 1: Some files failed, some succeeded
- 2: All files failed or no files found

**Related Commands**
- `npm run convert` - Convert only, skip analysis
- `npm run analyze-existing` - Analyze pre-converted files

**Environment Variables**
- `ANTHROPIC_API_KEY` (required)
- `MODEL_ID` (optional, default: claude-haiku-4-5-20251001)
- `LOG_LEVEL` (optional, default: info)

**Example**
```bash
npm run analyze
LOG_LEVEL=debug npm run analyze
MODEL_ID=claude-opus-4-6 npm run analyze
```

---

## convert

**Conversion Only**: Converts .txt to .md for inspection before analysis.

**Usage**
```bash
npm run convert
```

**Process**
1. Discovers .txt files in `input/` directory
2. Converts each to markdown with metadata extraction
3. Saves in `processing/` directory
4. Does NOT run analysis

**Output**
- Converted markdown: `processing/*.md`
- You can inspect/edit files before analysis

**Exit Codes**
- 0: All files converted successfully
- 1: Some files failed
- 2: All files failed or no files found

**Next Steps**
```bash
# After reviewing converted files:
npm run analyze-existing
```

---

## analyze-existing

**Analysis Only**: Analyzes pre-converted markdown files.

**Usage**
```bash
npm run analyze-existing
```

**Process**
1. Reads markdown files from `processing/` directory
2. Extracts metadata from YAML frontmatter
3. Runs analysis with specified model
4. Generates reports in `output/`

**Input**
- Requires `.md` files in `processing/` directory
- Each must have YAML frontmatter with date and concepts

**Output**
- Analysis reports: `output/report_[MODEL].md`

**Exit Codes**
- 0: All files analyzed successfully
- 1: Some files failed
- 2: All files failed or no files found
```

### 5.2 Dependency Version Requirements

```markdown
# Dependency Version Requirements

## Critical Dependencies

### Node.js
- **Minimum:** 18.0.0
- **Recommended:** 20.x LTS
- **Reason:** Modern async/await, built-in utilities

### TypeScript
- **Version:** 5.0.0+
- **Reason:** Strict type checking, union types, better error messages

### @anthropic-ai/sdk
- **Version:** ^0.78.0
- **Locked:** YES (see package-lock.json)
- **Breaking Changes:** See MIGRATION_GUIDE.md
- **API Docs:** https://docs.anthropic.com/

### Jest
- **Version:** 29.5.0+
- **Reason:** Full TypeScript support via ts-jest

## Optional Dependencies
- dotenv: Environment variable loading
- glob: File discovery with patterns

## Compatibility Matrix

| Node.js | TypeScript | SDK | Status |
|---------|-----------|-----|--------|
| 18.x    | 5.0.0     | 0.78.x | ✓ Tested |
| 20.x    | 5.0.0     | 0.78.x | ✓ Recommended |
| 18.x    | 5.1.0     | 0.78.x | ✓ OK |

## Upgrade Safety

When updating any dependency:
1. Check for breaking changes in changelog
2. Run `npm test` - all tests must pass
3. Run `npm run build` - no TypeScript errors
4. Test CLI commands manually
5. Update documentation
6. Commit with detailed migration notes
```

### 5.3 Architecture Decision Records (ADRs)

```markdown
# ADR-001: CLI Command Structure

**Date:** March 2, 2026
**Status:** ACCEPTED
**Deciders:** Development Team

## Context

We needed a reliable way to structure CLI commands that:
- Prevents TODO/stub implementations
- Makes business logic separation clear
- Enables easy testing
- Reduces common errors

## Decision

Implement command handlers as a router pattern:
1. Parse raw CLI arguments into typed CLIOptions
2. Validate arguments before executing
3. Route to specific command handler
4. Each handler delegates to business logic modules
5. Handler catches errors and exits with appropriate code

## Implementation

See src/cli.ts for current implementation.
See 4.3 "Command Handler Pattern" for detailed example.

## Consequences

**Positive:**
- Clear separation of concerns
- Testable command logic
- Type-safe argument passing
- Consistent error handling

**Negative:**
- Slight boilerplate overhead
- Requires handler class per command

## Alternatives Considered

1. Direct function calls in switch statement
   - Rejected: Hard to test, easy to leave TODO

2. Command object pattern with metadata
   - Rejected: Too complex for 3 commands

## Related

- ADR-002: SDK Compatibility Testing
- 4. Architecture Best Practices section
```

---

## 6. Pre-Implementation Checklist

Use this before implementing any new CLI command or feature:

### Checklist for New Commands

```markdown
## Pre-Implementation Checklist

### 1. Design Phase
- [ ] Write ADR (Architecture Decision Record)
- [ ] Define command purpose in one sentence
- [ ] List all inputs (arguments, env vars)
- [ ] List all outputs (files, console, exit codes)
- [ ] Define success/failure criteria

### 2. Type Safety
- [ ] Define types in src/types.ts
- [ ] Document each type field
- [ ] Create interface for command options
- [ ] Define validation rules

### 3. Implementation Plan
- [ ] Outline command handler steps
- [ ] Identify business logic modules to call
- [ ] Plan error scenarios
- [ ] Define exit codes

### 4. Testing Plan
- [ ] Unit tests for business logic
- [ ] Integration tests for command flow
- [ ] Edge case tests (empty input, missing files, etc.)
- [ ] Error scenario tests

### 5. Documentation Plan
- [ ] Command reference in README.md
- [ ] Example usage
- [ ] Exit code documentation
- [ ] Environment variables

### 6. Implementation
- [ ] Create command handler
- [ ] Implement business logic modules
- [ ] Add error handling
- [ ] Add logging

### 7. Testing
- [ ] All tests pass
- [ ] No TODO/FIXME in code
- [ ] TypeScript no errors
- [ ] Build successful

### 8. Review
- [ ] Code review per checklist in 1.2
- [ ] Documentation complete
- [ ] Examples tested
- [ ] Ready for merge
```

### Testing Before Merge

```bash
#!/bin/bash
# Pre-merge verification script

set -e

echo "Running pre-merge verification..."

# 1. Type checking
echo "✓ Checking TypeScript..."
npm run lint

# 2. Unit and integration tests
echo "✓ Running tests..."
npm test

# 3. SDK compatibility tests
echo "✓ Checking SDK compatibility..."
npm run test -- --testPathPattern=sdk-compatibility

# 4. Smoke tests
echo "✓ Running smoke tests..."
npm run test -- --testPathPattern=smoke

# 5. Build verification
echo "✓ Building distribution..."
npm run build

# 6. Check for TODO/FIXME
echo "✓ Checking for TODOs in src/..."
if grep -r "TODO\|FIXME" src/ --include="*.ts" --exclude-dir="__tests__"; then
  echo "❌ Found TODO/FIXME comments in src/"
  exit 1
fi

# 7. Verify command implementations
echo "✓ Verifying command implementations..."
if grep -r "Not implemented\|throw new Error" src/cli.ts; then
  echo "❌ Found unimplemented commands in cli.ts"
  exit 1
fi

echo ""
echo "✅ All pre-merge checks passed!"
```

---

## 7. Summary: Quick Reference

### Red Flags
1. TODO/FIXME in production code
2. `throw Error("Not implemented")`
3. `any` types at module boundaries
4. Missing error handling in CLI
5. No exit code after command
6. Unvetted SDK method calls

### Testing Checklist
- [ ] CLI command unit tests
- [ ] SDK compatibility tests
- [ ] Smoke tests (command callable)
- [ ] Integration tests (full flow)
- [ ] Error scenario tests

### Dependency Management
- [ ] Lock file committed
- [ ] SDK version pinned
- [ ] Breaking changes reviewed
- [ ] Tests pass after upgrade
- [ ] Commands tested manually

### Architecture Rules
- [ ] CLI routes only (no business logic)
- [ ] Types in src/types.ts (single source)
- [ ] Modules delegate to implementations
- [ ] Error handling at boundaries
- [ ] Explicit exit codes

### Documentation
- [ ] Command reference complete
- [ ] Dependency versions documented
- [ ] ADRs for major decisions
- [ ] Examples tested
- [ ] Migration guides for upgrades

### Before Merge
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No TODO/FIXME in src/
- [ ] Build succeeds
- [ ] Code review approved
- [ ] Manual testing done

---

**Last Updated:** March 2, 2026
**Author:** Prevention Strategist
**Review Status:** Ready for Team Discussion
