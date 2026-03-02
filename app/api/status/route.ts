/**
 * System Status Inspection API
 *
 * Provides agents with complete visibility into system readiness:
 * - Input directory status and file counts
 * - Conversion manifest validity and progress
 * - KMS data aggregation across all meetings
 * - Analysis completion status
 * - System readiness flags for agent decision logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { validateAuth } from '@/lib/auth';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();

/**
 * System status object returned to agents
 */
export interface SystemStatus {
  healthy: boolean;
  components: {
    inputDirectory: {
      exists: boolean;
      fileCount: number;
      totalSize: number;
    };
    conversionManifest: {
      exists: boolean;
      valid: boolean;
      processedCount: number;
      pendingCount: number;
      lastUpdated?: string;
    };
    kmsData: {
      exists: boolean;
      decisionCount: number;
      actionCount: number;
      riskCount: number;
      commitmentCount: number;
    };
    lastAnalysis: {
      timestamp?: string;
      filesProcessed: number;
    };
  };
  readiness: {
    canConvert: boolean;
    canAnalyze: boolean;
    kmsAvailable: boolean;
  };
}

/**
 * GET /api/status - System status inspection
 *
 * Returns complete system state for agent decision logic.
 * Agents can use this to determine:
 * - Whether to trigger conversion or analysis
 * - Whether KMS data is available
 * - Whether system is in healthy state
 *
 * Authentication: Required (Bearer JWT token)
 * Response: SystemStatus object
 */
export async function GET(request: NextRequest): Promise<NextResponse<SystemStatus | { error: string; details?: string }>> {
  // Validate authentication
  const authResult = validateAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authResult.error },
      { status: 401 }
    );
  }

  try {
    const baseDir = process.cwd();
    const inputDir = join(baseDir, 'input');
    const processingDir = join(baseDir, 'processing');
    const manifestPath = join(baseDir, '.processed_manifest.json');
    const kmsPath = join(baseDir, '.processed_kms.json');

    // ==========================================
    // Check input directory
    // ==========================================
    const inputExists = existsSync(inputDir);
    let inputFiles = 0;
    let inputSize = 0;

    if (inputExists) {
      try {
        const files = readdirSync(inputDir).filter((f) => f.endsWith('.txt'));
        inputFiles = files.length;
        inputSize = files.reduce((sum, f) => {
          try {
            return sum + statSync(join(inputDir, f)).size;
          } catch {
            return sum;
          }
        }, 0);
      } catch (error) {
        logger.warn(`Could not read input directory: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // ==========================================
    // Check conversion manifest
    // ==========================================
    let manifestExists = existsSync(manifestPath);
    let manifestValid = false;
    let processedCount = 0;
    let pendingCount = 0;
    let manifestUpdated: string | undefined;

    if (manifestExists) {
      try {
        const manifestContent = readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        manifestValid = Array.isArray(manifest.processed_files);
        processedCount = manifest.processed_files?.length || 0;
        pendingCount = Math.max(0, inputFiles - processedCount);
        manifestUpdated = manifest.last_run;
      } catch (error) {
        logger.warn(`Manifest validation failed: ${error instanceof Error ? error.message : String(error)}`);
        manifestValid = false;
      }
    }

    // ==========================================
    // Check KMS data
    // ==========================================
    let kmsExists = existsSync(kmsPath);
    let decisions = 0;
    let actions = 0;
    let risks = 0;
    let commitments = 0;

    if (kmsExists) {
      try {
        const kmsContent = readFileSync(kmsPath, 'utf-8');
        const kmsData = JSON.parse(kmsContent);

        // Aggregate across all meetings
        if (kmsData.meetings && typeof kmsData.meetings === 'object') {
          Object.values(kmsData.meetings).forEach((meeting: any) => {
            if (meeting && typeof meeting === 'object') {
              decisions += (meeting.decisions || []).length;
              actions += (meeting.actionItems || []).length;
              risks += (meeting.risks || []).length;
              commitments += (meeting.commitments || []).length;
            }
          });
        }
      } catch (error) {
        logger.warn(`KMS data validation failed: ${error instanceof Error ? error.message : String(error)}`);
        kmsExists = false;
      }
    }

    // ==========================================
    // Determine readiness flags
    // ==========================================
    const canConvert = inputExists && inputFiles > 0;
    const canAnalyze = existsSync(processingDir);
    const kmsAvailable = kmsExists && decisions > 0;

    // ==========================================
    // Determine overall health
    // ==========================================
    const healthy = inputExists && manifestValid && kmsAvailable;

    // ==========================================
    // Build response
    // ==========================================
    const status: SystemStatus = {
      healthy,
      components: {
        inputDirectory: {
          exists: inputExists,
          fileCount: inputFiles,
          totalSize: inputSize,
        },
        conversionManifest: {
          exists: manifestExists,
          valid: manifestValid,
          processedCount,
          pendingCount,
          lastUpdated: manifestUpdated,
        },
        kmsData: {
          exists: kmsExists,
          decisionCount: decisions,
          actionCount: actions,
          riskCount: risks,
          commitmentCount: commitments,
        },
        lastAnalysis: {
          timestamp: manifestUpdated,
          filesProcessed: processedCount,
        },
      },
      readiness: {
        canConvert,
        canAnalyze,
        kmsAvailable,
      },
    };

    logger.debug(`Status endpoint called`, {
      healthy,
      inputFiles,
      processedCount,
      pendingCount,
      kmsCount: decisions + actions + risks + commitments,
    });

    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Status endpoint failed: ${message}`);

    return NextResponse.json(
      {
        error: 'Failed to get system status',
        details: message,
      },
      { status: 500 }
    );
  }
}
