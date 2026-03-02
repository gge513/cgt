# Team Guide: Preventing CLI & SDK Issues

Quick reference for developers implementing features or updating dependencies.

---

## For Developers: Implementing New CLI Commands

### Step 1: Design (5 minutes)

Before writing code, answer these questions:

1. **What is the command's purpose?** (one sentence)
   - Example: "Convert .txt transcripts to markdown format"

2. **What inputs does it need?**
   - Command-line arguments?
   - Environment variables?
   - Files/directories?

3. **What outputs should it produce?**
   - Files? Console output? Exit codes?

4. **What can go wrong?** (error scenarios)
   - Missing files? Invalid input? API errors?

### Step 2: Create Types (10 minutes)

Add types to `src/types.ts` BEFORE implementing:

```typescript
// In src/types.ts

export interface YourCommandOptions {
  inputDir: string;
  outputDir: string;
  model: string;
  verbose?: boolean;
}

export interface YourCommandResult {
  processed: number;
  failed: number;
  errors: string[];
  exitCode: 0 | 1 | 2;
}
```

### Step 3: Write Tests First (20 minutes)

Create test file: `src/__tests__/your-command.test.ts`

```typescript
import { yourCommand } from "../your-command";

describe("Your Command", () => {
  test("should process files successfully", async () => {
    // Setup test data
    const result = await yourCommand({
      inputDir: testDir,
      outputDir: outputDir,
      model: "test-model",
    });

    // Verify behavior
    expect(result.exitCode).toBe(0);
    expect(result.processed).toBeGreaterThan(0);
  });

  test("should handle missing input directory", async () => {
    const result = await yourCommand({
      inputDir: "/nonexistent",
      outputDir: outputDir,
      model: "test-model",
    });

    expect(result.exitCode).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

### Step 4: Implement Business Logic (30 minutes)

Create `src/your-command.ts`:

```typescript
import { getLogger } from "./utils/logging";
import { validateDirectory } from "./utils/validation";
import { YourCommandOptions, YourCommandResult } from "./types";

const logger = getLogger();

/**
 * Implements your command logic
 * Keep this function pure - it doesn't touch CLI routing
 */
export async function yourCommand(
  options: YourCommandOptions
): Promise<YourCommandResult> {
  logger.info("Starting your command");

  const result: YourCommandResult = {
    processed: 0,
    failed: 0,
    errors: [],
    exitCode: 0,
  };

  // Validate inputs
  const inputCheck = validateDirectory(options.inputDir);
  if (!inputCheck.valid) {
    result.errors.push(inputCheck.error!);
    result.exitCode = 2;
    return result;
  }

  // Process files
  try {
    // Your logic here
    result.processed = 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    result.failed = 1;
    result.exitCode = 1;
  }

  return result;
}
```

### Step 5: Wire Into CLI (10 minutes)

Update `src/cli.ts`:

```typescript
// 1. Import your function
import { yourCommand } from "./your-command";
import { YourCommandOptions } from "./types";

// 2. Add command case
async function main(): Promise<void> {
  // ... existing code ...

  switch (command) {
    // ... existing cases ...

    case "your-command": {
      logger.info("Starting your command");
      const options: YourCommandOptions = {
        inputDir: "input",
        outputDir: "output",
        model: getModel(),
      };

      try {
        const result = await yourCommand(options);

        if (result.errors.length > 0) {
          result.errors.forEach(err => logger.error(err));
        }

        if (result.processed > 0) {
          console.log(`✓ Processed ${result.processed} items`);
        }

        process.exit(result.exitCode);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Command failed: ${message}`);
        process.exit(2);
      }
      break;
    }
  }
}
```

### Step 6: Test (10 minutes)

```bash
npm test -- your-command.test.ts
npm run lint  # Check types
npm run build # Verify compilation
```

### Step 7: Document (10 minutes)

Update `README.md`:

```markdown
## your-command

**Purpose**: Short description of what it does

**Usage**
```bash
npm run your-command
```

**Exit Codes**
- 0: Success
- 1: Partial success / some failures
- 2: Complete failure

**Example**
```bash
npm run your-command
```
```

### CRITICAL: Before Committing

Run the checklist:

```bash
# 1. No TODO/FIXME?
grep -n "TODO\|FIXME" src/your-command.ts && echo "FOUND TODOS" || echo "✓ No TODOs"

# 2. No unimplemented stubs?
grep -n "Not implemented" src/your-command.ts && echo "FOUND STUBS" || echo "✓ No stubs"

# 3. All tests pass?
npm test

# 4. TypeScript clean?
npm run lint

# 5. Build works?
npm run build

# 6. CLI wired correctly?
grep -n "case \"your-command\"" src/cli.ts && echo "✓ CLI wired"
```

---

## For Code Reviewers: What to Check

### Review Checklist for CLI/Command PRs

Use this checklist for every PR touching CLI code:

```markdown
## Code Review Checklist

### Implementation Completeness
- [ ] No TODO/FIXME comments in production code (src/)
- [ ] No `throw Error("Not implemented")`
- [ ] All command cases have exit statements
- [ ] Error handling surrounds async operations
- [ ] Return values are used (not ignored)

### Type Safety
- [ ] No `any` types at module boundaries
- [ ] Types defined in src/types.ts
- [ ] Function signatures match implementations
- [ ] Command options are typed (not loose objects)

### CLI Routing (src/cli.ts)
- [ ] Every case in switch statement has implementation
- [ ] Every implementation calls actual function (not stub)
- [ ] Exit codes are appropriate (0, 1, or 2)
- [ ] Error handling is present (try-catch)
- [ ] Logging shows progress

### Testing
- [ ] Tests exist for command
- [ ] Tests verify implementation (not just structure)
- [ ] All tests pass
- [ ] SDK compatibility verified
- [ ] Error scenarios tested

### Documentation
- [ ] Command documented in help text
- [ ] README updated with examples
- [ ] Environment variables documented
- [ ] Exit codes explained
- [ ] Migration notes if SDK upgrade

### Build & Quality
- [ ] `npm run lint` passes (no TypeScript errors)
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] No console.log (use logger)
- [ ] No commented-out code

### SDK Compatibility (if touching API calls)
- [ ] Using current SDK version from package.json
- [ ] SDK method exists in documentation
- [ ] Parameter types match SDK
- [ ] Error handling matches SDK patterns
- [ ] No deprecated methods used
```

### Red Flags to Block PR

If you see any of these, request changes:

1. **TODO/FIXME in src/** - Not production-ready
2. **throw Error("Not implemented")** - Stub code
3. **No exit code** - Process hangs or unclear result
4. **Unhandled async** - Random failures
5. **any types** - Type safety lost
6. **No tests** - Can't verify it works
7. **SDK method doesn't exist** - Runtime errors
8. **TypeScript errors** - Won't compile

---

## For Dependency Managers: Updating SDK

### When SDK Updates Are Available

```bash
npm outdated  # Check what's available
```

### Before Updating

1. **Read changelog** - Check for breaking changes
2. **Check PR** - What's the reason for update?
3. **Create branch** - Don't update on main

### Update Process

```bash
# 1. Create feature branch
git checkout -b chore/sdk-update

# 2. Update SDK
npm install @anthropic-ai/sdk@^0.79.0

# 3. Run full test suite
npm test                                  # All tests
npm run test -- --testPathPattern=sdk     # SDK tests only
npm run lint                              # TypeScript
npm run build                             # Build

# 4. If tests fail
# - Check what changed
# - Update code as needed
# - Document changes in commit

# 5. Commit
git add package.json package-lock.json
git commit -m "chore: update SDK to 0.79.0

- See CHANGELOG for breaking changes
- All tests pass
- No code changes needed
"

# 6. Create PR with detailed description
```

### If Breaking Changes

Document in commit:

```
chore: update SDK to 0.80.0 (breaking changes)

BREAKING CHANGES:
- messages.create() parameter 'system' renamed to 'system_prompt'
- Error type changed from APIError to AnthropicError

MIGRATION:
- Updated all .create() calls to use 'system_prompt'
- Updated error handling in metadata.ts
- See MIGRATION_GUIDE.md for details

TESTING:
- All 79 tests pass
- SDK compatibility tests pass
- Manual verification of analyze command
```

### Quick SDK Update Checklist

- [ ] Read changelog
- [ ] Update version in package.json
- [ ] Run `npm install`
- [ ] Run `npm test`
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Test CLI commands manually
- [ ] Document any code changes
- [ ] Create PR with detailed notes

---

## Common Mistakes & How to Avoid Them

### Mistake 1: Leaving TODO Comments

**WRONG:**
```typescript
case "analyze":
  // TODO: implement this
  logger.info("Not implemented");
  process.exit(1);
```

**RIGHT:**
```typescript
case "analyze":
  const result = await analyzeConvertedFiles(options, manifest);
  process.exit(result.exitCode);
```

**Prevention:** Grep for TODO before committing
```bash
grep -r "TODO\|FIXME" src/ --exclude-dir="__tests__"
```

### Mistake 2: Forgetting process.exit()

**WRONG:**
```typescript
case "convert":
  await convertTranscripts(inputDir, outputDir);
  // Oops - no exit, process hangs!
  break;
```

**RIGHT:**
```typescript
case "convert":
  const stats = await convertTranscripts(inputDir, outputDir);
  process.exit(stats.exitCode); // Always exit
  break;
```

**Prevention:** Code review - check every case has exit()

### Mistake 3: Skipping Error Handling

**WRONG:**
```typescript
const result = await analyzeFiles();  // What if this throws?
process.exit(0);
```

**RIGHT:**
```typescript
try {
  const result = await analyzeFiles();
  process.exit(result.exitCode);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`Failed: ${message}`);
  process.exit(2);
}
```

**Prevention:** Tests should verify error scenarios

### Mistake 4: Using SDK Method That Changed

**WRONG:**
```typescript
// This might work in SDK 0.77 but not 0.78
const response = await client.completion({
  prompt: "...",
});
```

**RIGHT:**
```typescript
// Use current SDK API
const message = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  messages: [{ role: "user", content: "..." }],
});
```

**Prevention:** Run SDK compatibility tests
```bash
npm test -- --testPathPattern=sdk-compatibility
```

### Mistake 5: Not Testing After SDK Update

**WRONG:**
```bash
npm install @anthropic-ai/sdk@latest
git commit -m "update SDK"
git push
# Oh no - code doesn't work anymore!
```

**RIGHT:**
```bash
npm install @anthropic-ai/sdk@^0.79.0
npm test          # Verify all tests still pass
npm run build     # Check TypeScript
git commit -m "..."  # Only then commit
```

**Prevention:** Pre-push verification script
```bash
./scripts/verify-before-push.sh
```

---

## Quick Decision Guide

### "Should I leave a TODO comment?"

| Situation | Answer | What to Do |
|-----------|--------|-----------|
| Feature not ready | **NO** | Don't push to main |
| Needs refactor later | **NO** | File issue, link in PR |
| Complex algorithm | **NO** | Add code comment explaining it |
| Temporary workaround | **MAYBE** | Mark with date: `TODO (2026-03-15): Remove workaround` |

### "Should I update the SDK?"

| Situation | Answer | Process |
|-----------|--------|---------|
| Patch version (0.78.1 → 0.78.2) | **YES** | Direct update, no testing |
| Minor version (0.78 → 0.79) | **YES** | Branch, test, PR |
| Major version (0.x → 1.0) | **DISCUSS** | Team decision, plan migration |
| Breaking changes | **PLAN FIRST** | ADR, estimate effort |

### "Should I modify cli.ts?"

| Type | Answer | Approach |
|------|--------|----------|
| Fix routing bug | **YES** | Update handler, test |
| New command | **YES** | Add case, implement handler |
| Refactor structure | **DISCUSS** | Consider impact on all commands |
| Move logic to module | **YES** | Extract to new file, delegate |

---

## Support & Escalation

### When in doubt:

1. **Check CLAUDE.md** - Architecture guide
2. **Check PREVENTION_STRATEGIES.md** - This document
3. **Look at existing commands** - Follow the pattern
4. **Run tests** - They tell you what's wrong
5. **Ask the team** - No shame in asking

### Common Questions

**Q: Can I leave a TODO if I document it well?**
A: No. If it's important enough to document, do it now. If not, create an issue.

**Q: Do I need to test SDK updates?**
A: Yes. Every update, even patch versions. SDK can have subtle changes.

**Q: What if a command is partially working?**
A: Don't merge. Either complete it or don't commit. Production needs to be stable.

**Q: How do I know if the SDK method signature changed?**
A: TypeScript will tell you. `npm run lint` will fail with type errors.

---

## Success Metrics

After implementing prevention strategies, you should see:

- ✓ Zero TODO/FIXME in production code
- ✓ 100% test pass rate before merge
- ✓ All CLI commands tested end-to-end
- ✓ SDK updates verified before deployment
- ✓ Zero "not implemented" errors in production
- ✓ Clear error messages instead of cryptic failures
- ✓ 10x faster debugging with proper logging

---

**Last Updated:** March 2, 2026
**Audience:** Development Team
**Format:** Copy-paste friendly
