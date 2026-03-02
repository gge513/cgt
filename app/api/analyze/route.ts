/**
 * Analysis Trigger API
 *
 * Starts analysis jobs asynchronously and returns job ID for polling.
 * Supports three modes:
 * - full: Convert + Analyze (default)
 * - convert: Convert only
 * - existing: Analyze existing converted files
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/lib/auth';
import { getJobManager, AnalysisMode } from '@/lib/analysis-jobs';
import { convertTranscripts } from '@/src/conversion/converter';
import { analyzeConvertedFiles } from '@/src/analysis/orchestrator';
import { ManifestManager } from '@/src/conversion/manifest';
import { getLogger, setLogLevel } from '@/src/utils/logging';
import { getModel } from '@/src/utils/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = getLogger();
const jobManager = getJobManager();

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authResult.error },
      { status: 401 }
    );
  }

  try {
    // Parse request body
    const body = await request.json();
    const mode: AnalysisMode = body.mode || 'full';

    // Validate mode
    if (!['full', 'convert', 'existing'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be: full, convert, or existing' },
        { status: 400 }
      );
    }

    // Create job
    const job = jobManager.createJob(mode);
    logger.info(`Created analysis job ${job.id} with mode: ${mode}`);

    // Start analysis asynchronously (don't wait for completion)
    runAnalysisAsync(job.id, mode).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      jobManager.failJob(job.id, message);
      logger.error(`Job ${job.id} failed: ${message}`);
    });

    // Return immediately with job ID (202 Accepted)
    return NextResponse.json(
      {
        jobId: job.id,
        status: 'queued',
        mode,
        pollUrl: `/api/analyze/status?jobId=${job.id}`,
        message: `Analysis job ${mode} queued. Poll the status URL to monitor progress.`,
      },
      { status: 202 }  // 202 Accepted - processing has not been completed
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to start analysis', details: message },
      { status: 500 }
    );
  }
}

/**
 * Run analysis asynchronously
 * Updates job progress as it executes
 */
async function runAnalysisAsync(jobId: string, mode: AnalysisMode): Promise<void> {
  const inputDir = 'input';
  const processingDir = 'processing';
  const outputDir = 'output';

  try {
    jobManager.setStatus(jobId, 'pending');

    if (mode === 'full' || mode === 'convert') {
      // Stage 1: Conversion
      jobManager.setStatus(jobId, 'converting');
      jobManager.updateProgress(jobId, 10);

      logger.info(`[Job ${jobId}] Starting conversion...`);
      const conversionStats = await convertTranscripts(inputDir, processingDir);

      logger.info(
        `[Job ${jobId}] Conversion complete: ${conversionStats.successful}/${conversionStats.total_found}`
      );
      jobManager.updateProgress(jobId, 50);

      if (mode === 'convert') {
        // Convert only - return results
        jobManager.completeJob(jobId, {
          filesConverted: conversionStats.successful,
          filesFailed: conversionStats.total_found - conversionStats.successful,
        });
        logger.info(`[Job ${jobId}] Convert-only job completed`);
        return;
      }
    }

    // Stage 2: Analysis (for 'full' or 'existing' mode)
    if (mode === 'full' || mode === 'existing') {
      jobManager.setStatus(jobId, 'analyzing');
      jobManager.updateProgress(jobId, mode === 'existing' ? 10 : 55);

      logger.info(`[Job ${jobId}] Starting analysis...`);

      const manifestManager = new ManifestManager();
      let manifest = manifestManager.loadManifest();

      const analysisResult = await analyzeConvertedFiles(
        {
          processingDir,
          outputDir,
          model: getModel(),
        },
        manifest
      );

      manifest = analysisResult.manifest;
      manifestManager.saveManifest(manifest);

      logger.info(
        `[Job ${jobId}] Analysis complete: ${analysisResult.analyzed} analyzed, ${analysisResult.skipped} skipped`
      );

      jobManager.updateProgress(jobId, 100);

      // Complete job with results
      jobManager.completeJob(jobId, {
        filesConverted: mode === 'full' ? 0 : undefined, // Only set for full mode
        filesAnalyzed: analysisResult.analyzed,
        filesFailed: analysisResult.skipped > 0 ? analysisResult.skipped : undefined,
      });

      logger.info(`[Job ${jobId}] Analysis job completed successfully`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    jobManager.failJob(jobId, message);
    logger.error(`[Job ${jobId}] Analysis failed: ${message}`, { error });
    throw error;
  }
}

/**
 * GET endpoint to poll job status
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authResult.error },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }

    const job = jobManager.getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found', details: `Job ID ${jobId} not found` },
        { status: 404 }
      );
    }

    // Build response
    const response: any = {
      jobId: job.id,
      mode: job.mode,
      status: job.status,
      progress: job.progress,
      startedAt: job.startedAt.toISOString(),
    };

    if (job.completedAt) {
      response.completedAt = job.completedAt.toISOString();
      response.durationSeconds = Math.round(
        (job.completedAt.getTime() - job.startedAt.getTime()) / 1000
      );
    }

    if (job.status === 'completed' && job.results) {
      response.results = job.results;
    }

    if (job.status === 'failed' && job.error) {
      response.error = job.error;
    }

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to get job status', details: message },
      { status: 500 }
    );
  }
}
