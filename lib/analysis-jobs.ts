/**
 * Analysis Job Management System
 *
 * Manages async analysis jobs with progress tracking.
 * Stores jobs in memory (consider Redis for production).
 */

import { v4 as uuid } from 'uuid';

export type AnalysisMode = 'full' | 'convert' | 'existing';
export type AnalysisStatus = 'pending' | 'converting' | 'analyzing' | 'completed' | 'failed';

export interface AnalysisResult {
  filesConverted?: number;
  filesAnalyzed?: number;
  filesFailed?: number;
  error?: string;
}

export interface AnalysisJob {
  id: string;
  mode: AnalysisMode;
  status: AnalysisStatus;
  progress: number;  // 0-100
  startedAt: Date;
  completedAt?: Date;
  results?: AnalysisResult;
  error?: string;
}

class AnalysisJobManager {
  private jobs = new Map<string, AnalysisJob>();
  private maxJobs = 1000;  // Prevent memory leak from accumulating jobs

  /**
   * Create a new analysis job
   */
  createJob(mode: AnalysisMode = 'full'): AnalysisJob {
    // Cleanup old completed jobs if approaching limit
    if (this.jobs.size >= this.maxJobs) {
      this.cleanupCompletedJobs();
    }

    const job: AnalysisJob = {
      id: uuid(),
      mode,
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
    };

    this.jobs.set(job.id, job);
    return job;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): AnalysisJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Update job progress
   */
  updateProgress(jobId: string, progress: number, status?: AnalysisStatus): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Ensure progress is 0-100
    job.progress = Math.max(0, Math.min(100, progress));

    if (status) {
      job.status = status;
    }
  }

  /**
   * Mark job as completed
   */
  completeJob(jobId: string, results: AnalysisResult): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date();
    job.results = results;
  }

  /**
   * Mark job as failed
   */
  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();
  }

  /**
   * Set job status
   */
  setStatus(jobId: string, status: AnalysisStatus): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = status;
  }

  /**
   * Cleanup completed jobs older than 24 hours
   */
  private cleanupCompletedJobs(): void {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const [jobId, job] of this.jobs) {
      if (job.status === 'completed' && job.completedAt && job.completedAt < oneDayAgo) {
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Get job count (for monitoring)
   */
  getJobCount(): number {
    return this.jobs.size;
  }

  /**
   * Get active job count
   */
  getActiveJobCount(): number {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status !== 'completed' && job.status !== 'failed'
    ).length;
  }
}

// Singleton instance
let manager: AnalysisJobManager | null = null;

/**
 * Get the global job manager instance
 */
export function getJobManager(): AnalysisJobManager {
  if (!manager) {
    manager = new AnalysisJobManager();
  }
  return manager;
}

/**
 * Export the class for testing
 */
export { AnalysisJobManager };
