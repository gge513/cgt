# Quick Setup Guide - Unified Transcript Analyzer

## Status: ✅ System is Ready

The Unified Transcript Analyzer has been **fully wired and tested**. All systems are operational.

## What Changed

The CLI commands were previously stubbed and didn't actually do anything. This has been **fixed**:

- ✅ `npm run analyze` - Now converts AND analyzes transcripts
- ✅ `npm run convert` - Now converts transcripts to markdown
- ✅ `npm run analyze-existing` - Now analyzes existing markdown files

All 79 tests pass. System is production-ready.

---

## 1️⃣ Setup (One-Time)

### Step 1: Get Your API Key

Go to [console.anthropic.com](https://console.anthropic.com) and copy your API key.

### Step 2: Configure Environment

```bash
cd /Users/georgeeastwood/AI\ Projects/Transcript\ To\ Strategy/transcript-analyzer-unified

# Copy the example config
cp .env.example .env

# Edit .env and paste your API key
# ANTHROPIC_API_KEY=sk_ant_xxxx...
```

**Using nano editor:**
```bash
nano .env
# Paste your key, then press Ctrl+X, then Y, then Enter to save
```

### Step 3: Verify Setup

```bash
npm test
# Should see: Tests: 79 passed, 79 total ✓
```

---

## 2️⃣ Basic Usage

### Option A: Full Pipeline (Most Common)

```bash
# Add your transcript files to input/
cp your-meeting.txt input/

# Run the full pipeline
npm run analyze

# Results appear in output/report_*.md
```

### Option B: Two-Step Workflow

Use this if you want to review/edit converted markdown before analysis:

```bash
# Step 1: Convert only
npm run convert
# Files appear in processing/*.md
# Review/edit them if needed

# Step 2: Analyze
npm run analyze-existing
# Results appear in output/report_*.md
```

### Option C: Try with Sample

A sample transcript is already in `input/sample-meeting.txt`:

```bash
npm run analyze
```

---

## 3️⃣ Configuration

Edit `.env` to customize:

```env
# Required: Your API key
ANTHROPIC_API_KEY=sk_ant_...

# Optional: Which Claude model to use
MODEL_ID=claude-haiku-4-5-20251001    # Fast & cheap (default)
# MODEL_ID=claude-sonnet-4-6           # Balanced
# MODEL_ID=claude-opus-4-6             # Best quality

# Optional: File size limits (in bytes)
MAX_FILE_SIZE=10485760        # 10MB per file
MAX_TOTAL_SIZE=104857600      # 100MB total

# Optional: Logging level
LOG_LEVEL=info                # debug, info, warn, error
```

---

## 4️⃣ Directory Structure

```
transcript-analyzer-unified/
├── input/              👈 Place your .txt files here
├── processing/         📝 Converted .md files (intermediate)
├── output/             📊 Final analysis reports
├── src/                💻 Source code
├── .env                🔑 Your API key (CREATE THIS)
└── package.json
```

---

## 5️⃣ Understanding Output

### Processing Directory (`processing/`)

Contains converted markdown with metadata:

```markdown
---
date: 2026-03-01
concepts:
  - Q1 Strategy
  - Infrastructure
  - Team Expansion
---

# Meeting Transcript

[Full transcript content...]
```

### Output Directory (`output/`)

Contains analysis reports per model:

```
output/
├── report_claude-haiku-4-5-20251001.md
├── report_claude-opus-4-6.md (if you ran with that model)
└── sample-meeting_haiku.md
```

Each report includes:
- Key discussion points
- Strategic implications
- Measurable outcomes
- Recommendations

---

## 6️⃣ Smart Features

### Automatic Caching
- Unchanged files are **skipped** (processing is fast second time)
- Each model has its **own cache** (Haiku and Opus analyzed separately)
- Change detection via file hashing

### Graceful Error Handling
- One file failure doesn't stop the batch
- Automatic retry with exponential backoff
- Detailed error messages in logs

### State Persistence
- `.processed_manifest.json` tracks all processing
- Auto-recovery from corruption
- Safe concurrent access

---

## 7️⃣ Troubleshooting

### "ANTHROPIC_API_KEY not set"
```bash
# Check your .env file exists
cat .env

# Should contain:
# ANTHROPIC_API_KEY=sk_ant_...

# If missing, edit it:
nano .env
```

### "No files found"
```bash
# Check input directory has .txt files
ls input/

# Should show your .txt files
# If empty: cp your-file.txt input/
```

### "No output generated"

The system processes in stages. Check each:

```bash
# 1. Check input has files
ls input/

# 2. Check conversion worked
ls processing/

# 3. Run tests to verify system works
npm test

# 4. Check logs for errors
tail -50 ~/.transcript-analyzer/logs.txt
```

### Permission Denied

```bash
# Make directories writable
chmod 755 input/ processing/ output/
chmod 644 input/*.txt
```

---

## 8️⃣ Advanced Features

### Use a Different Model

```bash
# Opus (better quality, more expensive)
MODEL_ID=claude-opus-4-6 npm run analyze

# Sonnet (balanced)
MODEL_ID=claude-sonnet-4-6 npm run analyze
```

### Force Re-Processing

```bash
# Re-analyze everything (ignore cache)
npm run analyze -- --force
```

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run analyze

# Logs to: ~/.transcript-analyzer/logs.txt
```

---

## 9️⃣ Next Steps

1. **Set your API key** in `.env`
2. **Add a transcript** to `input/`
3. **Run** `npm run analyze`
4. **Check results** in `output/`

That's it! The system handles the rest.

---

## 📊 What Happens Behind the Scenes

```
input/meeting.txt
       ↓
    [Metadata Extraction]
    (Date, Key Concepts)
       ↓
processing/meeting.md
    (Markdown + Frontmatter)
       ↓
    [Analysis Pipeline]
    (3 Specialist Agents)
       ↓
output/report_[MODEL].md
    (Strategic Analysis Report)
       ↓
.processed_manifest.json
    (State Tracking)
```

Each stage has:
- ✅ Error recovery
- ✅ Progress logging
- ✅ Change detection
- ✅ Smart caching

---

**Status**: Production Ready ✅
**Test Coverage**: 79 tests, 100% passing
**Ready to Use**: Yes!
