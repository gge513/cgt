# Refactoring Roadmap

## Overview

This document provides **concrete, actionable recommendations** for improving the Transcript To Strategy architecture. Each recommendation includes code examples, estimated effort, and implementation steps.

---

## Phase 1: Critical Fixes (Next Sprint - 8 hours)

### Task 1.1: Create KMS File Store Abstraction

**Priority:** CRITICAL
**Effort:** 2-3 hours
**Impact:** HIGH - Eliminates web API tight coupling, improves testability

**Current Problem:**
```typescript
// DUPLICATED in 5 different API routes
const kmsPath = path.join(process.cwd(), '.processed_kms.json');
const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));
```

**Solution: Create abstraction layer**

**File:** `src/kms/fileStore.ts`
```typescript
/**
 * Abstraction layer for KMS file persistence
 * Enables web layer to work with KMS data without direct filesystem coupling
 */

import * as fs from 'fs';
import * as path from 'path';
import { KMSStore, KMSData, KMSDecision } from '../types';
import { getLogger } from '../utils/logging';

const logger = getLogger();

export class KMSFileStore {
  private kmsPath: string;
  private tempPath: string;

  constructor(workingDir: string = process.cwd()) {
    this.kmsPath = path.join(workingDir, '.processed_kms.json');
    this.tempPath = path.join(workingDir, '.processed_kms.json.tmp');
  }

  /**
   * Load complete KMS store from disk
   * Returns empty store if not found or corrupted
   */
  getStore(): KMSStore | null {
    try {
      if (!fs.existsSync(this.kmsPath)) {
        logger.debug('KMS store not found');
        return null;
      }

      const content = fs.readFileSync(this.kmsPath, 'utf-8');
      return JSON.parse(content) as KMSStore;
    } catch (error) {
      logger.warn('Failed to load KMS store', error);
      return null;
    }
  }

  /**
   * Get all decisions across all meetings
   */
  getAllDecisions(): KMSDecision[] {
    const store = this.getStore();
    if (!store) return [];

    const decisions: KMSDecision[] = [];
    Object.values(store.meetings).forEach((meeting) => {
      if (meeting.decisions && Array.isArray(meeting.decisions)) {
        decisions.push(...meeting.decisions);
      }
    });
    return decisions;
  }

  /**
   * Find decision by ID
   */
  getDecision(decisionId: string): KMSDecision | undefined {
    const decisions = this.getAllDecisions();
    return decisions.find((d) => d.id === decisionId);
  }

  /**
   * Update decision with atomic writes
   */
  updateDecision(
    decisionId: string,
    update: Partial<KMSDecision>
  ): boolean {
    try {
      const store = this.getStore();
      if (!store) return false;

      let found = false;
      Object.values(store.meetings).forEach((meeting) => {
        const decision = meeting.decisions.find((d) => d.id === decisionId);
        if (decision) {
          Object.assign(decision, update);
          found = true;
        }
      });

      if (!found) {
        logger.warn(`Decision ${decisionId} not found`);
        return false;
      }

      this.saveStore(store);
      return true;
    } catch (error) {
      logger.error('Failed to update decision', error);
      return false;
    }
  }

  /**
   * Escalate a decision
   */
  escalateDecision(decisionId: string): boolean {
    return this.updateDecision(decisionId, { is_escalated: true });
  }

  /**
   * Mark decision as resolved
   */
  resolveDecision(decisionId: string): boolean {
    return this.updateDecision(decisionId, { status: 'completed' });
  }

  /**
   * Mark decision as high priority
   */
  prioritizeDecision(decisionId: string): boolean {
    return this.updateDecision(decisionId, { severity: 'high' });
  }

  /**
   * Save store atomically
   */
  private saveStore(store: KMSStore): void {
    try {
      store.lastUpdated = new Date().toISOString();
      fs.writeFileSync(
        this.tempPath,
        JSON.stringify(store, null, 2),
        'utf-8'
      );
      fs.renameSync(this.tempPath, this.kmsPath);
      logger.debug('KMS store saved');
    } catch (error) {
      logger.error('Failed to save KMS store', error);
      throw error;
    }
  }
}

// Export singleton for app layer
export const kmsStore = new KMSFileStore();
```

**Update API Routes:**

**File:** `app/api/kms/decisions/route.ts` (BEFORE)
```typescript
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  const kmsPath = path.join(process.cwd(), '.processed_kms.json');  // ✗ Duplication
  const kmsData = JSON.parse(fs.readFileSync(kmsPath, 'utf-8'));

  const decisions: any[] = [];
  if (kmsData.meetings && typeof kmsData.meetings === 'object') {
    Object.values(kmsData.meetings).forEach((meeting: any) => {
      if (meeting.decisions && Array.isArray(meeting.decisions)) {
        decisions.push(...meeting.decisions);
      }
    });
  }
  // ... filtering ...
}
```

**File:** `app/api/kms/decisions/route.ts` (AFTER)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { KMSFileStore } from '@core/kms/fileStore';

export async function GET(request: NextRequest) {
  try {
    const store = new KMSFileStore();
    const decisions = store.getAllDecisions();  // ✓ Clean abstraction

    if (!decisions.length) {
      return NextResponse.json(
        { error: 'KMS data not found. Run npm run analyze first.' },
        { status: 404 }
      );
    }

    // ... filtering ...
    return NextResponse.json({ decisions: filtered });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch decisions', details: String(error) },
      { status: 500 }
    );
  }
}
```

**Testing:**

```typescript
// tests/kms/fileStore.test.ts
import { KMSFileStore } from '@core/kms/fileStore';

describe('KMSFileStore', () => {
  it('should load decisions from store', () => {
    const store = new KMSFileStore();
    const decisions = store.getAllDecisions();
    expect(Array.isArray(decisions)).toBe(true);
  });

  it('should escalate decision atomically', () => {
    const store = new KMSFileStore();
    const decision = store.getDecision('some-id');

    store.escalateDecision('some-id');
    const updated = store.getDecision('some-id');
    expect(updated.is_escalated).toBe(true);
  });
});
```

**Implementation Steps:**
1. Create `src/kms/fileStore.ts` with class above
2. Update `app/api/kms/decisions/route.ts` to use `KMSFileStore`
3. Update `app/api/kms/summary/route.ts`
4. Update `app/api/kms/actions/route.ts` (remove applyActionToKMS)
5. Update `app/api/kms/relationships/route.ts`
6. Remove `app/api/kms/validate/route.ts` if validation moved to store
7. Add unit tests for KMSFileStore
8. Update web components to use API routes (not filesystem)

**Benefits:**
- ✓ Single source of KMS operations (all in one place)
- ✓ Testable without filesystem mocking
- ✓ Easy to migrate to database later
- ✓ Consistent state mutations (atomic)
- ✓ Clear contract for web layer

---

### Task 1.2: Consolidate Type Definitions

**Priority:** HIGH
**Effort:** 1 hour
**Impact:** MEDIUM - Prevents type divergence

**Current Problem:**
```typescript
// Identical type defined in TWO locations
// src/types.ts (lines 309-324)
export interface InferredRelationship { ... }

// app/types.ts (lines 3-18) - DUPLICATE!
export interface InferredRelationship { ... }
```

**Solution:**

**Step 1: Verify types are identical**
```bash
diff <(sed -n '309,324p' src/types.ts) <(sed -n '3,18p' app/types.ts)
```

**Step 2: Delete app/types.ts**
```bash
rm app/types.ts
```

**Step 3: Update imports in app layer**

**File:** `app/api/kms/relationships/route.ts` (BEFORE)
```typescript
import { InferredRelationship } from '@/types';  // ✗ From app/types.ts
```

**File:** `app/api/kms/relationships/route.ts` (AFTER)
```typescript
// Now we can import from src/types
// Once we update tsconfig to add @core alias
import { InferredRelationship } from '@core/types';
```

**Step 4: Update tsconfig.json**

**File:** `tsconfig.json` (BEFORE)
```json
{
  "paths": {
    "@/*": ["./app/*"]  // Only app/ is aliased
  }
}
```

**File:** `tsconfig.json` (AFTER)
```json
{
  "paths": {
    "@/*": ["./app/*"],
    "@core/*": ["./src/*"]  // Add src/ alias
  }
}
```

**Step 5: Update all imports**

Search and replace across `app/`:
```
@/types → @core/types
```

**Verification:**
```bash
# Should find ZERO duplicates
grep -r "interface InferredRelationship" .
# Should find exactly ONE definition
grep -r "interface InferredRelationship" src/
```

**Benefits:**
- ✓ Single source of truth for types
- ✓ Changes to types propagate automatically
- ✓ Reduces merge conflicts
- ✓ Easier to maintain consistency

---

### Task 1.3: Add Shared Enums

**Priority:** MEDIUM
**Effort:** 1 hour
**Impact:** MEDIUM - Improves type safety and consistency

**Current Problem:**
```typescript
// Hard-coded strings scattered throughout codebase:

// app/api/kms/actions/route.ts line 114
if (!['escalate', 'resolve', 'high-priority'].includes(action)) { }

// src/types.ts (multiple places)
status: "pending" | "in-progress" | "completed";
severity: "low" | "medium" | "high";
```

**Solution: Create enums module**

**File:** `src/types/enums.ts`
```typescript
/**
 * Centralized enums for type safety
 */

export enum ActionType {
  Escalate = 'escalate',
  Resolve = 'resolve',
  HighPriority = 'high-priority',
}

export enum DecisionStatus {
  Pending = 'pending',
  InProgress = 'in-progress',
  Completed = 'completed',
}

export enum ActionItemStatus {
  NotStarted = 'not-started',
  InProgress = 'in-progress',
  Blocked = 'blocked',
  Completed = 'completed',
}

export enum Severity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export enum RelationshipType {
  Blocks = 'blocks',
  Impacts = 'impacts',
  DependsOn = 'depends_on',
  RelatedTo = 'related_to',
}

// Type-safe validation functions
export function isValidAction(value: string): value is ActionType {
  return Object.values(ActionType).includes(value as ActionType);
}

export function isValidStatus(value: string): value is DecisionStatus {
  return Object.values(DecisionStatus).includes(value as DecisionStatus);
}

export function isValidSeverity(value: string): value is Severity {
  return Object.values(Severity).includes(value as Severity);
}
```

**Update types to use enums**

**File:** `src/types.ts` (BEFORE)
```typescript
export interface KMSDecision {
  status: "pending" | "in-progress" | "completed";  // ✗ String union
  // ...
}
```

**File:** `src/types.ts` (AFTER)
```typescript
import { DecisionStatus } from './enums';

export interface KMSDecision {
  status: DecisionStatus;  // ✓ Type-safe
  // ...
}
```

**Update API route to use enums**

**File:** `app/api/kms/actions/route.ts` (BEFORE)
```typescript
if (!['escalate', 'resolve', 'high-priority'].includes(action)) {  // ✗ Hard-coded
  return NextResponse.json(
    { error: 'Invalid action' },
    { status: 400 }
  );
}
```

**File:** `app/api/kms/actions/route.ts` (AFTER)
```typescript
import { ActionType, isValidAction } from '@core/types/enums';

if (!isValidAction(action)) {  // ✓ Type-safe validation
  return NextResponse.json(
    { error: 'Invalid action' },
    { status: 400 }
  );
}
```

**Benefits:**
- ✓ Type-safe throughout
- ✓ IDE autocomplete for values
- ✓ Central place to change values
- ✓ Validation functions prevent runtime errors

---

## Phase 2: Architectural Improvements (Sprint 2-3 - 10 hours)

### Task 2.1: Extract Orchestrator Complexity

**Priority:** HIGH
**Effort:** 4-5 hours
**Impact:** HIGH - Reduces cognitive load, enables testing

**Current Problem:**

`src/analysis/orchestrator.ts` handles 7 responsibilities:
- File discovery
- Metadata extraction
- Analysis orchestration
- Report generation
- KMS data extraction
- Relationship inference
- Manifest updates

**Solution: Extract file handling**

**File:** `src/analysis/fileHandler.ts`
```typescript
/**
 * Handles file I/O operations for analysis pipeline
 * Separates I/O concerns from orchestration logic
 */

import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '../utils/logging';
import { parseFrontmatter, extractMarkdownContent } from '../utils/parsing';
import { TranscriptMetadata } from '../types';

const logger = getLogger();

export class AnalysisFileHandler {
  /**
   * Discover markdown files in directory
   */
  static discoverMarkdownFiles(processingDir: string): string[] {
    try {
      if (!fs.existsSync(processingDir)) {
        logger.warn(`Processing directory not found: ${processingDir}`);
        return [];
      }

      const files = fs.readdirSync(processingDir);
      return files
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.join(processingDir, f));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error reading markdown files: ${message}`);
      return [];
    }
  }

  /**
   * Extract metadata from markdown file
   */
  static extractMetadata(filePath: string): TranscriptMetadata | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const markdownContent = extractMarkdownContent(content);

      if (!frontmatter) {
        return {
          date: 'Unknown',
          concepts: [],
          source: path.basename(filePath),
          content: markdownContent,
        };
      }

      const concepts = frontmatter.concepts
        ? Array.isArray(frontmatter.concepts)
          ? frontmatter.concepts
          : [frontmatter.concepts]
        : [];

      return {
        date: frontmatter.date || 'Unknown',
        concepts,
        source: path.basename(filePath),
        filename: path.basename(filePath),
        content: markdownContent,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error extracting metadata: ${message}`);
      return null;
    }
  }

  /**
   * Write report to file
   */
  static writeReport(outputDir: string, filename: string, content: string): boolean {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const reportPath = path.join(outputDir, filename);
      fs.writeFileSync(reportPath, content, 'utf-8');
      logger.info(`✓ Report written: ${filename}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error writing report: ${message}`);
      return false;
    }
  }
}
```

**Solution: Extract KMS coordination**

**File:** `src/analysis/kmsCoordinator.ts`
```typescript
/**
 * Coordinates KMS extraction and relationship inference
 * Separates knowledge extraction from analysis orchestration
 */

import { AnalysisReport, TranscriptMetadata, KMSData, InferredRelationship } from '../types';
import { extractKMSData, KMSStoreManager } from '../kms';
import { inferRelationshipsWithDSPy } from '../kms/relationshipInferencerDSPy';
import { getLogger } from '../utils/logging';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger();

export async function coordinateKMSExtraction(
  reportContent: string,
  meetingName: string,
  meetingDate: string
): Promise<KMSData | null> {
  try {
    logger.debug('Extracting KMS data from analysis report...');
    const kmsStoreManager = new KMSStoreManager();
    const kmsData = await extractKMSData(reportContent, meetingName, meetingDate);
    kmsStoreManager.recordKMSData(kmsData);

    logger.debug(
      `Extracted KMS: ${kmsData.decisions.length} decisions, ` +
      `${kmsData.actionItems.length} actions, ` +
      `${kmsData.commitments.length} commitments, ` +
      `${kmsData.risks.length} risks`
    );

    return kmsData;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`KMS extraction failed (non-fatal): ${message}`);
    return null;
  }
}

export async function coordinateRelationshipInference(): Promise<InferredRelationship[]> {
  try {
    logger.debug('Running relationship inference on KMS data...');
    const kmsStoreManager = new KMSStoreManager();
    const kmsStore = kmsStoreManager.getStore();

    if (!kmsStore || Object.keys(kmsStore.meetings).length === 0) {
      logger.debug('No KMS data available for relationship inference');
      return [];
    }

    const inferencedRelationships = await inferRelationshipsWithDSPy(kmsStore);
    logger.info(`✓ Inferred ${inferencedRelationships.length} relationships`);
    return inferencedRelationships;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Relationship inference failed (non-fatal): ${message}`);
    return [];
  }
}

export function persistInferredRelationships(relationships: InferredRelationship[]): void {
  try {
    if (relationships.length === 0) return;

    const inferredPath = path.join(process.cwd(), '.processed_kms_inferred.json');
    const inferredStore = {
      version: 1,
      inferredAt: new Date().toISOString(),
      totalRelationships: relationships.length,
      relationships,
    };

    fs.writeFileSync(inferredPath, JSON.stringify(inferredStore, null, 2), 'utf-8');
    logger.debug('Inferred relationships saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to persist relationships: ${message}`);
  }
}
```

**Refactor orchestrator**

**File:** `src/analysis/orchestrator.ts` (BEFORE)
```typescript
// 320 lines with 7 responsibilities mixed together
export async function analyzeConvertedFiles(...) {
  // ... file discovery code ...
  // ... metadata extraction code ...
  // ... analysis code ...
  // ... report generation code ...
  // ... KMS extraction code ...
  // ... relationship inference code ...
  // ... manifest updates code ...
}
```

**File:** `src/analysis/orchestrator.ts` (AFTER)
```typescript
/**
 * Analysis Orchestrator (Simplified)
 * Coordinates analysis pipeline stages
 * Individual concerns extracted to separate modules
 */

import { AnalysisOptions } from './types';
import { AnalysisFileHandler } from './fileHandler';
import { synthesizeAnalysis } from './synthesisCoordinator';
import { generateMarkdownReport } from './reportGenerator';
import { ManifestManager } from '../conversion/manifest';
import {
  coordinateKMSExtraction,
  coordinateRelationshipInference,
  persistInferredRelationships
} from './kmsCoordinator';

export async function analyzeConvertedFiles(
  options: AnalysisOptions,
  manifest: Manifest
) {
  const stats = {
    analyzed: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
    reportFiles: [] as string[],
    manifest,
    exitCode: 0 as 0 | 1 | 2,
  };

  try {
    // Stage 1: File Discovery
    const markdownFiles = AnalysisFileHandler.discoverMarkdownFiles(
      options.processingDir
    );

    // Stage 2: Cache Check & Filtering
    const manifestManager = new ManifestManager();
    const filesToAnalyze = markdownFiles.filter((mdFile) => {
      const outputFileName = path.basename(mdFile, '.md') + '.md';
      return manifestManager.isAnalysisNeeded(
        outputFileName,
        options.model,
        manifest,
        options.force
      );
    });

    // Stage 3: Metadata Extraction
    const transcripts = filesToAnalyze
      .map((mdFile) => AnalysisFileHandler.extractMetadata(mdFile))
      .filter((m) => m !== null) as TranscriptMetadata[];

    // Stage 4: Analysis
    const report = await synthesizeAnalysis(transcripts);

    // Stage 5: Report Generation
    const reportContent = generateMarkdownReport(report, options.model);
    const reportFilename = generateReportFilename(filesToAnalyze[0], options.model);
    const reportWritten = AnalysisFileHandler.writeReport(
      options.outputDir,
      reportFilename,
      reportContent
    );

    if (!reportWritten) {
      stats.failed = transcripts.length;
      stats.exitCode = 2;
      return stats;
    }

    // Stage 6: KMS Extraction
    const kmsData = await coordinateKMSExtraction(
      reportContent,
      path.basename(filesToAnalyze[0], '.md'),
      transcripts[0].date
    );

    // Stage 7: Relationship Inference
    const relationships = await coordinateRelationshipInference();
    persistInferredRelationships(relationships);

    // Stage 8: Manifest Update
    for (const mdFile of filesToAnalyze) {
      const outputFileName = path.basename(mdFile, '.md') + '.md';
      manifestManager.recordAnalysis(manifest, outputFileName, options.model, reportFilename);
    }
    manifestManager.saveManifest(manifest);

    stats.analyzed = transcripts.length;
    stats.reportFiles.push(reportPath);
    stats.exitCode = 0;

    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Analysis failed: ${message}`);
    stats.errors.push(`Analysis error: ${message}`);
    stats.failed = markdownFiles?.length || 0;
    stats.exitCode = 2;
    return stats;
  }
}
```

**Benefits:**
- ✓ Orchestrator is now 100 lines instead of 320
- ✓ Clear pipeline stages
- ✓ Each concern is testable independently
- ✓ Easier to add new stages
- ✓ Simpler error handling per stage

---

### Task 2.2: Implement Agent Interface & Registry

**Priority:** MEDIUM
**Effort:** 2-3 hours
**Impact:** MEDIUM - Makes agent system extensible

**Current Problem:**

No formal agent contract - agents are just functions. Adding new agent requires:
1. Understanding synthesisCoordinator internals
2. Modifying synthesizeAnalysis() function
3. Updating AnalysisReport interface

**Solution: Agent interface and registry**

**File:** `src/analysis/agents/types.ts`
```typescript
/**
 * Agent interface and registry for analysis system
 * Enables extensible, pluggable agents
 */

import { TranscriptMetadata } from '../../types';

export interface AnalysisAgent {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  analyze(transcripts: TranscriptMetadata[]): Promise<Record<string, any>>;
}

export interface AgentRegistry {
  register(agent: AnalysisAgent): void;
  getAgent(id: string): AnalysisAgent | undefined;
  getAllAgents(): AnalysisAgent[];
  getAgentIds(): string[];
}

export class DefaultAgentRegistry implements AgentRegistry {
  private agents = new Map<string, AnalysisAgent>();

  register(agent: AnalysisAgent): void {
    this.agents.set(agent.id, agent);
  }

  getAgent(id: string): AnalysisAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AnalysisAgent[] {
    return Array.from(this.agents.values());
  }

  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }
}
```

**Adapt existing agents to interface**

**File:** `src/analysis/agents/strategicAnalyst.ts` (BEFORE)
```typescript
export async function analyzeStrategic(
  transcripts: TranscriptMetadata[]
): Promise<StrategicAnalysis> {
  // ... implementation ...
}
```

**File:** `src/analysis/agents/strategicAnalyst.ts` (AFTER)
```typescript
import { AnalysisAgent } from './types';

export const StrategicAnalystAgent: AnalysisAgent = {
  id: 'strategic-analyst',
  name: 'Strategic Analyst',
  description: 'Analyzes strategic themes, patterns, and opportunities',

  async analyze(transcripts: TranscriptMetadata[]): Promise<Record<string, any>> {
    // ... existing implementation ...
    return {
      themes: [...],
      patterns: [...],
      opportunities: [...],
      risks: [...]
    };
  }
};
```

**Create agent coordinator using registry**

**File:** `src/analysis/agentCoordinator.ts`
```typescript
/**
 * Coordinates multi-agent analysis
 * Uses registry pattern for extensible agent system
 */

import { TranscriptMetadata, AnalysisReport } from '../types';
import { AnalysisAgent, DefaultAgentRegistry } from './agents/types';
import { StrategicAnalystAgent } from './agents/strategicAnalyst';
import { StakeholderAnalyzerAgent } from './agents/stakeholderAnalyzer';
import { FinancialOpsAnalyzerAgent } from './agents/financialOpsAnalyzer';
import { getLogger } from '../utils/logging';

const logger = getLogger();

export class AgentCoordinator {
  private registry: DefaultAgentRegistry;

  constructor() {
    this.registry = new DefaultAgentRegistry();
    this.registerDefaultAgents();
  }

  /**
   * Register built-in agents
   */
  private registerDefaultAgents(): void {
    this.registry.register(StrategicAnalystAgent);
    this.registry.register(StakeholderAnalyzerAgent);
    this.registry.register(FinancialOpsAnalyzerAgent);
  }

  /**
   * Run all registered agents in parallel
   */
  async runAllAgents(
    transcripts: TranscriptMetadata[]
  ): Promise<Record<string, any>> {
    const agents = this.registry.getAllAgents();
    logger.info(`Running ${agents.length} agents...`);

    const results = await Promise.all(
      agents.map(async (agent) => {
        try {
          logger.debug(`Running agent: ${agent.name}`);
          const result = await agent.analyze(transcripts);
          return { [agent.id]: result };
        } catch (error) {
          logger.error(`Agent ${agent.id} failed:`, error);
          throw error;
        }
      })
    );

    return Object.assign({}, ...results);
  }

  /**
   * Allow registering custom agents at runtime
   */
  registerAgent(agent: AnalysisAgent): void {
    logger.info(`Registering agent: ${agent.id}`);
    this.registry.register(agent);
  }
}

/**
 * Convenience function for synthesis
 */
export async function synthesizeWithAgents(
  transcripts: TranscriptMetadata[]
): Promise<Record<string, any>> {
  const coordinator = new AgentCoordinator();
  return await coordinator.runAllAgents(transcripts);
}
```

**Update synthesisCoordinator to use agents**

**File:** `src/analysis/synthesisCoordinator.ts` (BEFORE)
```typescript
export async function synthesizeAnalysis(
  transcripts: TranscriptMetadata[]
): Promise<AnalysisReport> {
  // Directly calls individual agent functions
  const [strategic, stakeholder, financial] = await Promise.all([
    analyzeStrategic(transcripts),
    analyzeStakeholders(transcripts),
    analyzeFinancialOps(transcripts),
  ]);
  // ... combine results ...
}
```

**File:** `src/analysis/synthesisCoordinator.ts` (AFTER)
```typescript
import { synthesizeWithAgents } from './agentCoordinator';

export async function synthesizeAnalysis(
  transcripts: TranscriptMetadata[]
): Promise<AnalysisReport> {
  const agentResults = await synthesizeWithAgents(transcripts);

  return {
    executive_summary: generateExecutiveSummary(agentResults),
    strategic_analysis: agentResults['strategic-analyst'],
    stakeholder_analysis: agentResults['stakeholder-analyzer'],
    financial_ops_analysis: agentResults['financial-ops-analyzer'],
    strategic_recommendations: generateRecommendations(agentResults),
    implementation_timeline: generateTimeline(agentResults),
  };
}
```

**Adding new agent is now easy:**

```typescript
// Custom agent
export const CustomAgent: AnalysisAgent = {
  id: 'custom-analyzer',
  name: 'Custom Analyzer',
  description: 'My custom analysis',

  async analyze(transcripts) {
    // ... analysis logic ...
    return { /* results */ };
  }
};

// Register it
coordinator.registerAgent(CustomAgent);
```

**Benefits:**
- ✓ Open/Closed Principle - open for extension, closed for modification
- ✓ New agents don't require modifying coordinator
- ✓ Agents can be registered at runtime
- ✓ Clear contract for agent implementations
- ✓ Easier to test individual agents

---

## Phase 3: Code Quality (Sprint 4 - 6 hours)

### Task 3.1: DRY Up CLI Command Handlers

**Priority:** MEDIUM
**Effort:** 2-3 hours
**Impact:** LOW - Code quality, easier maintenance

**Current Problem:**

CLI has 3 nearly identical command handlers (lines 84-126, 129-150, 152-186).

**Solution: Extract pipeline abstraction**

```typescript
// src/cli/pipeline.ts
interface PipelineStage {
  name: string;
  execute(): Promise<PipelineStageResult>;
}

interface PipelineStageResult {
  success: boolean;
  stats: Record<string, any>;
  errors: string[];
}

async function executePipeline(stages: PipelineStage[]): Promise<number> {
  for (const stage of stages) {
    logger.info(`Starting ${stage.name}...`);
    const result = await stage.execute();

    if (!result.success) {
      logger.error(`${stage.name} failed`);
      return 2; // Failure exit code
    }

    logger.info(`${stage.name} complete`);
  }

  return 0; // Success exit code
}

// Use in CLI
const stages: PipelineStage[] = [];
if (!analyzeOnly) stages.push(conversionStage);
if (!convertOnly) stages.push(analysisStage);

const exitCode = await executePipeline(stages);
process.exit(exitCode);
```

---

### Task 3.2: Create API Validation Utilities

**Priority:** LOW
**Effort:** 1 hour
**Impact:** LOW - Consistency, DRY

**Solution: Shared validation**

```typescript
// src/api/validators.ts
import { ActionType, Severity, DecisionStatus } from '../types/enums';

export function validateAction(action: unknown): ActionType {
  if (!Object.values(ActionType).includes(action as ActionType)) {
    throw new Error(`Invalid action: ${action}`);
  }
  return action as ActionType;
}

export function validateKMSDataExists<T>(data: T | null, source: string): T {
  if (!data) {
    throw new Error(`KMS data not found. Run npm run analyze first.`);
  }
  return data;
}

// Use in API routes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = validateAction(body.action);  // Type-safe!
    // ...
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
```

---

## Phase 4: Infrastructure (Future - 5+ hours)

### Task 4.1: Manifest Versioning

**Priority:** LOW
**Effort:** 2-3 hours
**Impact:** MEDIUM - Allows schema evolution

**Add schema versioning:**

```typescript
// src/conversion/manifestVersions.ts
export const MANIFEST_CURRENT_VERSION = 2;

export interface ManifestV1 {
  version: 1;
  last_run: string;
  processed_files: ProcessedFileV1[];
}

export interface ManifestV2 {
  version: 2;
  schema_version: string;
  last_run: string;
  processed_files: ProcessedFileV2[];
}

export function migrateManifest(old: any): Manifest {
  if (old.version === 1) {
    return migrateFromV1toV2(old);
  }
  return old; // Already latest
}
```

---

### Task 4.2: Database Migration Plan

**Priority:** LOW (Plan for 1000+ decisions)
**Effort:** 20+ hours (future)
**Impact:** HIGH - Scales to enterprise

When you reach 1000+ decisions:
- Replace `.processed_kms.json` with SQLite/PostgreSQL
- Keep `src/kms/fileStore.ts` interface (swap implementation)
- No web layer changes needed!

```typescript
// src/kms/fileStore.ts (future: database version)
export class KMSFileStore {
  private db: Database;  // SQLite/PostgreSQL

  getStore(): KMSStore {
    const decisions = this.db.query('SELECT * FROM decisions');
    // ... build KMSStore from queries ...
  }

  updateDecision(id: string, update: Partial<KMSDecision>) {
    this.db.query('UPDATE decisions SET ... WHERE id = ?', [id]);
  }
}
```

---

## Summary: Implementation Order

**Recommended execution order:**

```
Week 1:
  - Task 1.1: KMS File Store (2-3h) [CRITICAL]
  - Task 1.2: Consolidate Types (1h) [HIGH]
  - Task 1.3: Add Enums (1h) [MEDIUM]

Week 2-3:
  - Task 2.1: Extract Orchestrator (4-5h) [HIGH]
  - Task 2.2: Agent Interface (2-3h) [MEDIUM]

Week 4:
  - Task 3.1: CLI DRY (2-3h) [MEDIUM]
  - Task 3.2: Validation Utils (1h) [LOW]

Future:
  - Task 4.1: Manifest Versioning [Plan]
  - Task 4.2: Database Migration [Plan for 1000+]
```

**Total Effort:** ~20 hours across 4 weeks

**Expected Outcome:**
- More maintainable codebase
- Better separation of concerns
- Easier to add features
- Improved testability

---

Last Updated: March 2, 2026

