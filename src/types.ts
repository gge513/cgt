/**
 * Unified Transcript Analyzer Type Definitions
 * Defines all data structures for conversion, analysis, and manifest tracking
 */

// ============================================================================
// CONVERSION TYPES
// ============================================================================

/**
 * Conversion state tracking for a single file
 */
export interface ConversionState {
  file_hash: string;           // MD5 hash of .txt content
  converted_at: string;        // ISO 8601 timestamp
  source_file: string;         // Original .txt filename
  output_file: string;         // Generated .md filename (with date prefix)
}

/**
 * Metadata extracted from transcript content
 */
export interface TranscriptMetadata {
  date: string;                // YYYY-MM-DD or "Unknown"
  concepts: string[];          // Array of identified concepts/themes
  source?: string;             // Optional source identifier
  filename?: string;           // Optional filename for display
  content?: string;            // Optional full transcript content for analysis
}

/**
 * Result of transcript conversion
 */
export interface ConversionResult {
  success: boolean;
  markdown_content: string;    // Full .md content with frontmatter
  metadata: TranscriptMetadata;
  errors?: string[];           // Any non-fatal errors encountered
}

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

/**
 * Per-model analysis cache entry
 */
export interface AnalysisCacheEntry {
  model: string;               // Claude model ID used
  analyzed_at: string;         // ISO 8601 timestamp
  report_file: string;         // Generated report filename
  cache_key?: string;          // Unique cache key for this analysis
}

/**
 * Analysis cache tracking by model
 */
export interface AnalysisCache {
  [model: string]: AnalysisCacheEntry;
}

/**
 * Strategic analysis output
 */
export interface StrategicAnalysis {
  themes: string[];
  patterns: string[];
  opportunities: string[];
  risks: string[];
}

/**
 * Stakeholder analysis output
 */
export interface StakeholderAnalysis {
  participants: string[];
  sentiment_overview: string;
  consensus_points: string[];
  disagreements: string[];
  stakeholder_positions: Record<string, string>;
}

/**
 * Financial and operations analysis output
 */
export interface FinancialOpsAnalysis {
  financial_concerns: string[];
  operational_bottlenecks: string[];
  resource_constraints: string[];
  compliance_issues: string[];
}

/**
 * Complete analysis report
 */
export interface AnalysisReport {
  executive_summary: string;
  strategic_analysis: StrategicAnalysis;
  stakeholder_analysis: StakeholderAnalysis;
  financial_ops_analysis: FinancialOpsAnalysis;
  strategic_recommendations: StrategicRecommendation[];
  implementation_timeline: TimelineItem[];
}

/**
 * Strategic recommendation with priority
 */
export interface StrategicRecommendation {
  title: string;
  description: string;
  rationale: string;
  priority: "high" | "medium" | "low";
  estimated_impact: string;
}

/**
 * Timeline item for implementation
 */
export interface TimelineItem {
  phase: number;
  description: string;
  duration: string;
  dependencies: string[];
  owner?: string;
}

// ============================================================================
// MANIFEST TYPES
// ============================================================================

/**
 * Single file entry in manifest
 */
export interface ProcessedFile {
  input_file: string;          // Original .txt filename
  output_file: string;         // Generated .md filename
  conversions: ConversionState;
  analyses: AnalysisCache;     // Per-model analysis caches
}

/**
 * Complete processing manifest
 */
export interface Manifest {
  version: 1;
  last_run: string;            // ISO 8601 timestamp of last run
  processed_files: ProcessedFile[];
}

// ============================================================================
// PIPELINE TYPES
// ============================================================================

/**
 * Options for running the unified pipeline
 */
export interface PipelineOptions {
  convertOnly?: boolean;       // Skip analysis
  analyzeOnly?: boolean;       // Skip conversion
  model?: string;              // Claude model to use
  force?: boolean;             // Ignore manifest, reprocess everything
  forceConvert?: boolean;      // Re-convert all files
  forceAnalyze?: boolean;      // Re-analyze all files
  noCache?: boolean;           // Skip caches
  inputDir?: string;           // Custom input directory
  processingDir?: string;      // Custom processing directory
  outputDir?: string;          // Custom output directory
}

/**
 * Result of pipeline execution
 */
export interface PipelineResult {
  converted: number;           // Files successfully converted
  analyzed: number;            // Files successfully analyzed
  failed: number;              // Files that failed
  errors: string[];            // Error messages
  reportFiles: string[];       // Generated report files
  exitCode: 0 | 1 | 2;        // 0=success, 1=partial, 2=failure
}

// ============================================================================
// FILE HANDLING TYPES
// ============================================================================

/**
 * File discovery result
 */
export interface DiscoveredFiles {
  files: string[];             // Full paths to files
  total_size: number;          // Total size in bytes
  count: number;               // Number of files
}

/**
 * File validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

// ============================================================================
// LOGGING TYPES
// ============================================================================

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error"
}

export interface LogEntry {
  timestamp: string;           // ISO 8601 timestamp
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

// ============================================================================
// KNOWLEDGE MANAGEMENT SYSTEM (KMS) TYPES
// ============================================================================

/**
 * Extracted decision from meeting
 */
export interface KMSDecision {
  id: string;                  // Unique identifier
  text: string;                // Decision text
  owner?: string;              // Person/role responsible
  date: string;                // Decision date (from meeting)
  meeting: string;             // Source meeting file
  relatedTopics: string[];     // Related concept tags
  status: "pending" | "in-progress" | "completed";
  context?: string;            // Additional context
}

/**
 * Extracted action item from meeting
 */
export interface KMSActionItem {
  id: string;                  // Unique identifier
  text: string;                // Action description
  owner?: string;              // Person responsible
  dueDate?: string;            // Expected completion date
  meeting: string;             // Source meeting file
  status: "not-started" | "in-progress" | "blocked" | "completed";
  blockers: string[];          // Known blockers/dependencies
  context?: string;            // Additional context
}

/**
 * Extracted commitment from meeting
 */
export interface KMSCommitment {
  id: string;                  // Unique identifier
  text: string;                // Commitment text
  owner?: string;              // Person making commitment
  dueDate?: string;            // Expected completion date
  meeting: string;             // Source meeting file
  status: "pending" | "in-progress" | "completed";
  context?: string;            // Additional context
}

/**
 * Extracted risk from meeting
 */
export interface KMSRisk {
  id: string;                  // Unique identifier
  text: string;                // Risk description
  severity: "low" | "medium" | "high";
  meeting: string;             // Source meeting file
  mitigation?: string;         // Mitigation strategy
  context?: string;            // Additional context
}

/**
 * Complete KMS data for a single meeting
 */
export interface KMSData {
  meeting: string;             // Meeting identifier
  analyzedAt: string;          // When KMS was extracted (ISO timestamp)
  date: string;                // Meeting date
  model: string;               // Claude model used
  decisions: KMSDecision[];
  actionItems: KMSActionItem[];
  commitments: KMSCommitment[];
  risks: KMSRisk[];
}

/**
 * KMS data store (all meetings)
 */
export interface KMSStore {
  version: 1;
  lastUpdated: string;         // ISO timestamp
  meetings: Record<string, KMSData>; // Keyed by meeting name
}
