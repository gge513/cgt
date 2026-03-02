# Knowledge Management System (KMS) Guide

Your Unified Transcript Analyzer now includes a **Knowledge Management System** that automatically extracts and tracks decisions, action items, commitments, and risks from meeting analysis.

## ✨ What It Does

Every time you run analysis, the system:
1. Generates strategic analysis report (as before)
2. **[NEW]** Extracts structured KMS data using Claude
3. Stores decisions, actions, commitments, risks in searchable database
4. Provides CLI query interface to search across all meetings

## 🚀 Quick Start

### Run Analysis (KMS Extraction Happens Automatically)
```bash
npm run analyze
# or
npm run analyze-existing
```

When complete, KMS data is stored in `.processed_kms.json`

### Query Your Data
```bash
# Show summary of all meetings
npm run kms -- --summary

# Find all decisions
npm run kms -- --type decision

# Find action items for a person
npm run kms -- --type action --owner "Danielle Alpher"

# Find all high-priority risks
npm run kms -- --type risk --severity high

# Search by keyword
npm run kms -- -k "financial"
```

---

## 📊 Extracted Data Types

### 1. **Decisions** 🎯
Strategic decisions made with:
- Decision text
- Owner/decision maker
- Status (pending, in-progress, completed)
- Related topics

**Example:**
```
Hire external bookkeeper (Veronique) to replace Amy
and remediate financial control breakdown.
Owner: Quan Heng Sunim
Status: pending
```

### 2. **Action Items** ✓
Concrete next steps with:
- Action description
- Owner (who does it)
- Due date (if specified)
- Status (not-started, in-progress, blocked, completed)
- Blockers (what's preventing progress)

**Example:**
```
Complete full financial reconciliation for January-September
Owner: Danielle Alpher
Status: in-progress
Blockers: Bookkeeper lacks competency
```

### 3. **Commitments** 🤝
Promises made by people:
- Commitment text
- Who committed
- Due date
- Status

**Example:**
```
Provide ongoing strategic advisory support for nonprofit governance
Owner: George Eastwood
Status: pending
```

### 4. **Risks** ⚠️
Issues and threats with:
- Risk description
- Severity (low, medium, high)
- Mitigation strategy

**Example:**
```
Continued financial mismanagement threatens donor confidence
Severity: high
Mitigation: Hire qualified bookkeeper, establish controls
```

---

## 🔍 Query Commands

### View Summaries
```bash
# Overall KMS summary
npm run kms -- --summary
npm run kms -- -s
```

### Query by Type
```bash
# All decisions
npm run kms -- --type decision
npm run kms -- -t decision

# All action items
npm run kms -- --type action

# All commitments
npm run kms -- --type commitment

# All risks
npm run kms -- --type risk
```

### Filter by Owner
```bash
# All decisions by Danielle
npm run kms -- --type decision --owner "Danielle Alpher"

# All commitments by George
npm run kms -- --type commitment --owner "George Eastwood"

# All actions for someone
npm run kms -- --type action --owner "Quan Heng Sunim"
```

### Filter by Status
```bash
# All pending decisions
npm run kms -- --type decision --status pending

# All blocked action items (stuck)
npm run kms -- --type action --status blocked

# All in-progress actions
npm run kms -- --type action --status in-progress

# All completed actions
npm run kms -- --type action --status completed
```

### Filter by Due Date
```bash
# All actions due before March 15, 2026
npm run kms -- --type action --due 2026-03-15
```

### Filter by Risk Severity
```bash
# All high-priority risks
npm run kms -- --type risk --severity high

# All medium/high risks
npm run kms -- --type risk --severity medium
```

### Search by Keyword
```bash
# Search for anything related to "financial"
npm run kms -- -k "financial"
npm run kms -- --keyword "financial"

# Search for "scalability"
npm run kms -- -k scalability

# Multi-word search
npm run kms -- -k "API infrastructure"
```

### Combine Filters
```bash
# Danielle's pending action items (not yet started)
npm run kms -- --type action --owner "Danielle Alpher" --status not-started

# High-priority risks that lack mitigation
npm run kms -- --type risk --severity high
```

---

## 📈 Example Workflows

### Tracking Progress on Action Items
```bash
# See what's assigned to you
npm run kms -- --type action --owner "Your Name"

# See what's blocked
npm run kms -- --type action --status blocked

# See what's done
npm run kms -- --type action --status completed
```

### Risk Management
```bash
# What are our biggest risks?
npm run kms -- --type risk --severity high

# Are there any mitigations in place?
npm run kms -- --type risk
```

### Leadership Decision Tracking
```bash
# What major decisions were made?
npm run kms -- --type decision

# Who made them?
npm run kms -- --type decision --owner "Sunim"

# What are the dependencies?
npm run kms -- -k "depends on"
```

### Finding Topics Across Meetings
```bash
# What was discussed about scaling?
npm run kms -- -k scaling

# What about user growth?
npm run kms -- -k "user growth"

# What financial issues were discussed?
npm run kms -- -k financial
```

---

## 💾 Data Storage

KMS data is stored in **`.processed_kms.json`** with structure:

```json
{
  "version": 1,
  "lastUpdated": "2026-03-02T04:37:19.633Z",
  "meetings": {
    "meeting-name": {
      "meeting": "meeting-name",
      "date": "2026-03-01",
      "model": "claude-haiku-4-5-20251001",
      "decisions": [...],
      "actionItems": [...],
      "commitments": [...],
      "risks": [...]
    }
  }
}
```

### File Locations
- **KMS Data**: `.processed_kms.json` (created when analysis runs)
- **Manifest**: `.processed_manifest.json` (tracks conversion/analysis state)
- **Reports**: `output/*_report_*.md` (analysis text reports)

---

## 🔄 How It Works

1. **Run Analysis**
   ```
   npm run analyze
   ```

2. **System Generates Report**
   - Three specialist agents analyze the transcript
   - Report written to `output/`

3. **KMS Extraction** ← [NEW]
   - Claude reads the analysis report
   - Extracts structured decisions, actions, risks
   - Stores in `.processed_kms.json`

4. **Query Your Data**
   ```
   npm run kms -- --type decision
   ```

---

## ✅ Real-World Examples

### Get Your Action Items
```bash
$ npm run kms -- --type action --owner "Danielle Alpher"

✓ ACTION ITEMS (5)
══════════════════════════════════════════════════

1. Complete full financial reconciliation for January-September
   ID: ACT001
   Owner: Danielle Alpher
   Status: in-progress
   Blockers: Bookkeeper (Amy) lacks competency

2. Develop and document comprehensive job descriptions
   ID: ACT002
   Owner: Danielle Alpher
   Status: not-started

... (3 more)
```

### Find Blocked Items
```bash
$ npm run kms -- --type action --status blocked

✓ ACTION ITEMS (1)
══════════════════════════════════════════════════

1. Address Amy's performance through formal PIP
   ID: ACT005
   Owner: Quan Heng Sunim
   Status: blocked
   Blockers: Leadership hesitation to make personnel decisions
```

### Search Topics
```bash
$ npm run kms -- -k "financial"

🔍 SEARCH RESULTS (9)
══════════════════════════════════════════════════

DECISION (3):
  • Hire external bookkeeper...
  • Implement financial controls...
  • Evaluate Quantum Americas partnership...

ACTION (3):
  • Complete financial reconciliation...
  • Develop financial control policies...
  • Establish Finance Committee...

... (3 more)
```

---

## 🎯 Key Benefits

| Benefit | Before | After |
|---------|--------|-------|
| **Find decisions** | Re-read reports manually | `npm run kms --type decision` |
| **Track actions** | Spreadsheet/notes | `npm run kms --type action --status in-progress` |
| **Find by owner** | Read entire report | `npm run kms --type action --owner Alice` |
| **Find risks** | Search report text | `npm run kms --type risk --severity high` |
| **Search topics** | CTRL+F across files | `npm run kms -k "scalability"` |
| **Track progress** | Manual status updates | Extracted automatically from analysis |
| **Multi-meeting analysis** | Compare manually | Query across all meetings automatically |

---

## 🔮 What's Stored in KMS

For each meeting analyzed, KMS extracts:

**Decisions:**
- ✅ What was decided
- ✅ Who decided it
- ✅ Whether it's pending/in-progress/done
- ✅ Related topics

**Actions:**
- ✅ What needs to be done
- ✅ Who owns it
- ✅ When it's due
- ✅ What's blocking it
- ✅ Current status

**Commitments:**
- ✅ What people committed to
- ✅ Who committed
- ✅ Due dates
- ✅ Status

**Risks:**
- ✅ What could go wrong
- ✅ How serious (severity)
- ✅ How to mitigate it

---

## 💡 Tips

### Organize Your Queries
Create bash aliases for frequent searches:

```bash
# Add to your .zshrc or .bashrc
alias kms_summary='cd ~/path/to/analyzer && npm run kms -- --summary'
alias kms_myactions='npm run kms -- --type action --owner "YOUR NAME"'
alias kms_risks='npm run kms -- --type risk --severity high'
alias kms_find='npm run kms -- -k'
```

Then use:
```bash
kms_summary
kms_myactions
kms_risks
kms_find "keyword"
```

### Export Data
View the JSON directly for integration with other tools:

```bash
cat .processed_kms.json | jq '.meetings'
cat .processed_kms.json | jq '.meetings | .[] | .decisions'
```

### Share Results
```bash
# Save query result to file
npm run kms -- --type action > actions.txt

# Share via email
npm run kms -- --type decision | mail -s "Decisions" team@example.com
```

---

## 📚 Full Help

```bash
npm run kms -- --help
```

---

**The KMS system turns your analysis reports into a queryable knowledge base!**

Every meeting you analyze adds more data. Over time, you build a searchable repository of all decisions, actions, and risks across your organization.

Start analyzing → KMS data is extracted automatically → Query anytime.
