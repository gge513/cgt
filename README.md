# Transcript Analyzer Unified

A unified Node.js/TypeScript system that combines transcript conversion and multi-agent AI analysis into a single workflow.

**Status:** Phase 1 - Foundation Complete ✓

## Quick Start

```bash
# Install dependencies
npm install

# Copy example env
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY

# Run analysis (full pipeline: convert + analyze)
npm run analyze

# Or specific commands
npm run convert              # Convert only
npm run analyze-existing    # Analyze only
```

## Three Commands

### `npm run analyze` (Full Pipeline)
Converts `.txt` transcripts to `.md` and generates strategic analysis reports in one command.

```bash
npm run analyze
# Result: input/*.txt → processing/*.md → output/report_[MODEL].md
```

### `npm run convert` (Conversion Only)
Converts `.txt` to `.md` so you can inspect and review before analysis.

```bash
npm run convert
# Result: input/*.txt → processing/*.md
# Users can now review/edit .md files
npm run analyze-existing  # Re-analyze after edits
```

### `npm run analyze-existing` (Analysis Only)
Analyzes existing `.md` files without reconversion.

```bash
npm run analyze-existing
# Reads from processing/ or output/
# Result: output/report_[MODEL].md
```

## Advanced Usage

### Switch Models
```bash
# Default (cheap, fast)
npm run analyze

# Better quality (more expensive)
MODEL_ID=claude-opus-4-6 npm run analyze

# Balanced
MODEL_ID=claude-sonnet-4-6 npm run analyze
```

### Model Comparison
```bash
# Run with Haiku (cached)
npm run analyze

# Run with Opus (separate cache, same input files)
MODEL_ID=claude-opus-4-6 npm run analyze

# Each model has its own report: report_haiku.md, report_opus.md
```

## Directory Structure

```
transcript-analyzer-unified/
├── input/          # Place your .txt files here
├── processing/     # Converted .md files (intermediate)
├── output/         # Final analysis reports
├── src/
│   ├── conversion/     # (Phase 2) Conversion logic
│   ├── analysis/       # (Phase 3) Analysis logic
│   ├── utils/          # Shared utilities
│   ├── cli.ts          # Command routing
│   ├── types.ts        # Type definitions
│   └── index.ts        # Main entry point
├── test/           # Tests (Phase 6)
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Configuration

### Required
- `ANTHROPIC_API_KEY` - Get from [console.anthropic.com](https://console.anthropic.com)

### Optional
- `MODEL_ID` - Claude model (default: `claude-haiku-4-5-20251001`)
- `MAX_FILE_SIZE` - Per-file limit in bytes (default: 10MB)
- `MAX_TOTAL_SIZE` - Total input limit in bytes (default: 100MB)
- `LOG_LEVEL` - Logging level: debug, info, warn, error (default: info)

### Set via Environment
```bash
export ANTHROPIC_API_KEY="your-key"
export MODEL_ID="claude-opus-4-6"
npm run analyze
```

### Or in .env File
```env
ANTHROPIC_API_KEY=your-key
MODEL_ID=claude-opus-4-6
MAX_FILE_SIZE=10485760
MAX_TOTAL_SIZE=104857600
LOG_LEVEL=info
```

## Development

```bash
# Install dependencies
npm install

# Type check
npm run lint

# Run tests
npm test
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report

# Build TypeScript
npm run build

# Run in dev mode
npm run dev
```

## Architecture

### Phase 1: Foundation ✓
- Type system defined
- CLI skeleton created
- Logging and validation utilities
- Configuration management

### Phase 2: Conversion (Upcoming)
- Port Python converter to TypeScript
- Metadata extraction (dates, concepts)
- Manifest-based state tracking
- Folder structure preservation

### Phase 3: Analysis (Upcoming)
- Integrate multi-agent analyzer
- Frontmatter parsing
- Per-model report generation
- Pipeline orchestration

### Phase 4: Caching (Upcoming)
- Per-model analysis caching
- Cache key algorithm
- Force reprocessing flags

### Phase 5: Error Handling (Upcoming)
- Graceful error recovery
- Input validation
- API timeout retry logic

### Phase 6: Testing (Upcoming)
- Unit tests (80%+ coverage)
- Integration tests
- Edge case tests
- Error recovery tests

### Phase 7: Documentation (Upcoming)
- Complete README
- API documentation
- Migration guide
- Usage examples

## Key Decisions

1. **Unified Node.js/TypeScript** - Single language, shared utilities, better IDE support
2. **Three Commands** - Simple for most users, flexible for power users
3. **Per-Model Caching** - Run same data through Haiku (cheap) and Opus (expensive) separately
4. **Staged Directories** - Users can inspect converted `.md` before analysis
5. **Graceful Errors** - Single file failure doesn't halt batch processing

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
```bash
export ANTHROPIC_API_KEY="your-key"
# Or create .env file with ANTHROPIC_API_KEY=your-key
```

### "No files found"
Ensure `.txt` files are in the `input/` directory

### "Permission denied"
Check file permissions and directory access:
```bash
chmod 755 input/ processing/ output/
chmod 644 input/*.txt
```

## Estimated Timeline

- Phase 2 (Conversion): 3 days
- Phase 3 (Analysis): 3 days
- Phase 4 (Caching): 2 days
- Phase 5 (Error Handling): 2 days
- Phase 6 (Testing): 3 days
- Phase 7 (Documentation): 2 days

**Total: ~15 days** (starting after Phase 1 foundation)

## Next Steps

1. Install dependencies: `npm install`
2. Set API key: `export ANTHROPIC_API_KEY="your-key"`
3. Add test transcripts to `input/` directory
4. Implementation of Phase 2 begins (conversion core)

---

**Status:** Phase 1 Complete - Ready for Phase 2
**Last Updated:** March 1, 2026
