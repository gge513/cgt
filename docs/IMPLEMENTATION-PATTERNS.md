# KMS Implementation Patterns: Quick Reference

**Purpose**: Fast lookup guide for implementing Phase 2 patterns in new code
**Audience**: Developers adding features or endpoints
**Last Updated**: March 2, 2026

---

## Quick Decision Tree

```
Need to read a file?
├─ Is it .processed_*.json?
│  ├─ YES → Use MtimeCache (auto-invalidates, prevents N+1)
│  └─ NO → Use SafeFileSystem (validates path)
│
Need to write a file?
├─ Is it a system file?
│  ├─ YES → Use AtomicFileWriter (temp + rename)
│  └─ NO → Use writeFileSync (simple case)
│
Need to accept external data?
├─ Is it JSON?
│  ├─ YES → Use Zod schema (validates all fields)
│  └─ NO → Use manual validation
│
Need to validate a path?
└─ Always use SafeFileContext.resolve() or SafeFileSystem
```

---

## Copy-Paste Templates

### Template 1: Load KMS Data (Cached)

```typescript
import { getKMSData } from '@/lib/cache';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();

export async function GET(request: NextRequest) {
  try {
    // Load with automatic cache invalidation
    const store = getKMSData();

    if (!store || store.meetings.length === 0) {
      return NextResponse.json(
        { error: 'No KMS data found' },
        { status: 404 }
      );
    }

    // Return response
    return NextResponse.json({
      total: store.meetings.length,
      meetings: Object.keys(store.meetings),
    });
  } catch (error) {
    logger.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json(
      { error: 'Failed to load KMS data' },
      { status: 500 }
    );
  }
}
```

### Template 2: Write File Atomically

```typescript
import { SafeFileContext } from '@/src/utils/paths';
import { getLogger } from '@/src/utils/logging';
import * as fs from 'fs';

const logger = getLogger();
const fileContext = new SafeFileContext(process.cwd());

function saveStore(data: Record<string, unknown>, filename: string): void {
  const safePath = fileContext.resolve(filename);
  const tempPath = safePath + '.tmp';

  try {
    // Write to temp file
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');

    // Verify temp file exists
    if (!fs.existsSync(tempPath)) {
      throw new Error('Temp file creation failed');
    }

    // Atomic rename
    fs.renameSync(tempPath, safePath);

    // Verify final file exists
    if (!fs.existsSync(safePath)) {
      throw new Error('File rename failed');
    }

    logger.debug(`Saved ${filename} (atomic)`);
  } catch (error) {
    // Cleanup temp file
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupError) {
      logger.warn(`Cleanup failed: ${cleanupError}`);
    }

    throw error;
  }
}
```

### Template 3: Validate and Parse JSON

```typescript
import { z } from 'zod';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();

// Define strict schema
const myDataSchema = z.object({
  version: z.literal(1),
  data: z.string().min(1).max(2000),
  timestamp: z.string().datetime(),
});

type MyData = z.infer<typeof myDataSchema>;

/**
 * Safe parsing with error handling
 */
export function parseMyData(content: string): MyData {
  try {
    const parsed = JSON.parse(content);
    return myDataSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      logger.error(`Validation failed: ${messages}`);
      throw new Error(`Invalid data format: ${messages}`);
    }

    if (error instanceof SyntaxError) {
      logger.error(`JSON parse error: ${error.message}`);
      throw new Error('Invalid JSON format');
    }

    throw error;
  }
}

// Usage:
const data = parseMyData(fileContent);
```

### Template 4: Validate Path (No Escape)

```typescript
import { SafeFileContext } from '@/src/utils/paths';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();
const fileContext = new SafeFileContext(process.cwd());

export function safeReadFile(filename: string): string {
  try {
    // This validates the path (throws if ../ or absolute)
    const safePath = fileContext.resolve(filename);
    return fs.readFileSync(safePath, 'utf-8');
  } catch (error) {
    if (error instanceof Error && error.message.includes('traversal')) {
      logger.warn(`Path traversal attempt: ${filename}`);
      throw new Error('Invalid file path');
    }
    throw error;
  }
}
```

### Template 5: Dual-Layer Caching

```typescript
import { cacheGet, cacheSet, cacheInvalidatePattern } from '@/lib/cache';
import { getKMSData } from '@/lib/cache';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Layer 1: Check TTL cache
    const cacheKey = `decisions:${status || 'all'}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      logger.debug(`Cache hit: ${cacheKey}`);
      return NextResponse.json(cached);
    }

    // Layer 2: Load data (mtime cache)
    const store = getKMSData();

    // Filter decisions
    let decisions = [];
    Object.values(store.meetings).forEach((meeting) => {
      if (meeting.decisions) {
        if (status) {
          decisions.push(
            ...meeting.decisions.filter((d) => d.status === status)
          );
        } else {
          decisions.push(...meeting.decisions);
        }
      }
    });

    const result = {
      total: decisions.length,
      decisions,
    };

    // Cache filtered result (30 seconds)
    cacheSet(cacheKey, result);
    logger.debug(`Cache set: ${cacheKey}`);

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`Failed: ${error}`);
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}
```

---

## Common Patterns & Anti-Patterns

### Pattern: Validating Request Body

```typescript
// ✅ DO THIS
const { data } = await request.json();
const validated = mySchema.parse(data);
// Now use validated.field with confidence

// ❌ DON'T DO THIS
const { data } = await request.json();
use(data);  // No validation!
```

### Pattern: Handling Validation Errors

```typescript
// ✅ DO THIS
try {
  return schema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.error(`Validation error: ${error.message}`);
    return null;
  }
  throw error;  // Re-throw unexpected errors
}

// ❌ DON'T DO THIS
try {
  return schema.parse(data);
} catch (error) {
  // Silent failure! Bugs hide here.
}
```

### Pattern: File Operations

```typescript
// ✅ DO THIS (Atomic)
const tempPath = finalPath + '.tmp';
fs.writeFileSync(tempPath, content);
fs.renameSync(tempPath, finalPath);  // Atomic!

// ❌ DON'T DO THIS (Non-atomic)
fs.writeFileSync(finalPath, content);  // Can corrupt on crash!
```

### Pattern: Path Validation

```typescript
// ✅ DO THIS (Safe)
const context = new SafeFileContext(process.cwd());
const safePath = context.resolve(userInput);
// Now safePath is guaranteed to be within process.cwd()

// ❌ DON'T DO THIS (Vulnerable)
const path = userInput;  // Could be ../../../etc/passwd!
```

### Pattern: Caching

```typescript
// ✅ DO THIS (mtime-aware)
const data = getKMSData();  // Auto-invalidates on file change

// ❌ DON'T DO THIS (stale data)
const data = JSON.parse(fs.readFileSync(path));  // Reads every time!
```

---

## Debugging Checklist

When something goes wrong, check:

### "Data seems stale"
- [ ] Is cache being invalidated after writes?
  ```typescript
  invalidateKMSCache();  // After any write!
  ```
- [ ] Is mtime matching?
  ```typescript
  logger.debug(`Cache mtime: ${cached.mtime}, file mtime: ${stat.mtimeMs}`);
  ```

### "Validation failing"
- [ ] Check exact error message:
  ```typescript
  try {
    schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.log(error.issues);  // See exactly what failed
    }
  }
  ```
- [ ] Is data type correct?
- [ ] Are optional fields properly marked?

### "Path traversal not caught"
- [ ] Is SafeFileContext being used?
- [ ] Is resolve() being called?
- [ ] Does path start with ../ or /etc/?

### "File corruption on crash"
- [ ] Is atomic write pattern used (temp + rename)?
- [ ] Is temp file cleaned up on error?
- [ ] Is final file verified after rename?

### "Slow API responses"
- [ ] Is cache hit happening? (Check logs)
  ```
  Cache hit: decisions:all
  ```
- [ ] Response time <100ms for cached?
- [ ] Are multiple queries needed? (N+1)

---

## Performance Targets

| Operation | Target | How to Verify |
|-----------|--------|------------------|
| Cache hit | <1ms | Benchmark with 1000 iterations |
| File read | <10ms | Monitor stat() call overhead |
| Validation | <5ms | Zod parse() with large object |
| Atomic write | <50ms | Time temp write + rename |
| JSON parse | <10ms | Time JSON.parse() on large file |

Check with:
```typescript
const start = performance.now();
// ... operation ...
const duration = performance.now() - start;
console.log(`Operation took ${duration.toFixed(2)}ms`);
```

---

## Testing Patterns

### Test: Cache invalidation
```typescript
it('should invalidate cache on file change', () => {
  const data1 = getKMSData();
  // Modify file
  saveKMSStore(data1);
  const data2 = getKMSData();
  expect(data2.lastUpdated).not.toBe(data1.lastUpdated);
});
```

### Test: Path traversal blocked
```typescript
it('should block ../ paths', () => {
  expect(() => {
    fileContext.resolve('../../../etc/passwd');
  }).toThrow('path traversal');
});
```

### Test: Schema validation
```typescript
it('should reject invalid data', () => {
  expect(() => {
    schema.parse({ /* missing required field */ });
  }).toThrow();
});
```

### Test: Atomic write survives crash
```typescript
it('should not corrupt file on error', () => {
  jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
    throw new Error('Write failed');
  });

  expect(() => saveStore(data)).toThrow();
  expect(fs.existsSync('.tmp')).toBe(false);  // Cleanup happened
});
```

---

## Glossary

**mtime**: File modification time in milliseconds (used for cache invalidation)
**Atomic operation**: All-or-nothing (temp file + rename pattern)
**Zod**: TypeScript-first schema validation library
**Path traversal**: Attack using ../ to escape intended directory
**SafeFileContext**: Class ensuring all paths stay within base directory
**TTL cache**: Time-to-live cache (expires after 30 seconds)
**Schema**: Rules defining what valid data looks like
**Validation**: Checking that data matches schema before using it

---

## Quick Links

- [Full Prevention Strategies Guide](./PHASE2-PREVENTION-STRATEGIES.md)
- [CLAUDE.md - Architecture Overview](../CLAUDE.md)
- [Type Definitions](../src/types.ts)
- [Zod Schemas](../lib/validation-schemas.ts)
- [Cache Implementation](../lib/cache.ts)
- [Path Security](../src/utils/paths.ts)

---

**Version**: 1.0
**Status**: Production Ready
**Feedback**: Update this guide when you add new patterns!
