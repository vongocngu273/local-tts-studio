import crypto from 'crypto';
import type { ProviderId, VoiceSettings } from '@shared/types/provider.types';
import type { TTSJob, QueueStatus, QueueEvent } from '@shared/types/queue.types';
import { jobRepository } from '../../database/repositories/job.repository';
import { segmentRepository } from '../../database/repositories/segment.repository';
import { projectRepository } from '../../database/repositories/project.repository';
import { providerRegistry } from '../../providers/provider.registry';
import { audioStorageService } from '../audio/audioStorage.service';
import { ffprobeService } from '../ffmpeg/ffprobe.service';
import { RetryPolicy } from './retryPolicy';
import { logger } from '../logger/logger';

export class JobQueueService {
  private isPaused = false;
  private isProcessing = false;
  private activeJobs = new Map<string, TTSJob>();
  private listeners: ((event: QueueEvent) => void)[] = [];
  private workerTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  // Maximum concurrent requests per provider
  private readonly providerConcurrency: Record<ProviderId, number> = {
    'edge-tts': 2,
    lucylab: 1,
    elevenlabs: 1,
    vbee: 1
  };

  constructor() {
    this.startTimers();
  }

  public subscribe(listener: (event: QueueEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: QueueEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error('queue:event', 'Error dispatching queue event', err);
      }
    }
  }

  private startTimers(): void {
    if (!this.workerTimer) {
      this.workerTimer = setInterval(() => {
        this.processNext().catch((err) => {
          logger.error('queue:worker', 'Unhandled error in queue worker interval', err);
        });
      }, 500);
    }

    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this.updateHeartbeats();
      }, 5000);
    }
  }

  public stopTimers(): void {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private updateHeartbeats(): void {
    for (const [id] of this.activeJobs.entries()) {
      try {
        jobRepository.updateHeartbeat(id);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Enqueues all eligible or specified segments for a project.
   */
  public async enqueueSegments(
    projectId: string,
    segmentIds?: string[],
    priority = 0
  ): Promise<TTSJob[]> {
    const project = projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    if (!project.processedText || project.processedText.trim().length === 0) {
      throw new Error('Project processed text is empty. Process script before generating audio.');
    }

    const allSegments = segmentRepository.listByProject(projectId);
    const targetSegments = allSegments.filter((seg) => {
      if (segmentIds && segmentIds.length > 0) {
        return segmentIds.includes(seg.id);
      }
      return seg.status === 'pending' || seg.status === 'failed' || seg.status === 'queued';
    });

    if (targetSegments.length === 0) {
      return [];
    }

    const createdJobs: TTSJob[] = [];
    const now = new Date().toISOString();

    for (const seg of targetSegments) {
      // Mark segment as queued
      segmentRepository.update(seg.id, {
        status: 'queued',
        errorCode: null,
        errorMessage: null
      });

      const job: TTSJob = {
        id: crypto.randomUUID(),
        projectId,
        segmentId: seg.id,
        jobType: 'segment_tts',
        providerId: seg.providerId || project.providerId as ProviderId || 'edge-tts',
        status: 'pending',
        priority,
        attempt: 0,
        maxAttempts: RetryPolicy.DEFAULT_MAX_ATTEMPTS,
        providerJobId: null,
        payload: {
          text: seg.text,
          voiceId: seg.voiceId || project.voiceId,
          settings: seg.settings
        },
        result: null,
        availableAt: now,
        startedAt: null,
        heartbeatAt: null,
        completedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now
      };

      createdJobs.push(job);
    }

    jobRepository.insertBatch(createdJobs);

    logger.info(
      'queue:service',
      `Enqueued ${createdJobs.length} segment TTS job(s) for project ${projectId}`
    );

    this.emit({
      type: 'queue:progress',
      projectId,
      status: this.getQueueStatus(projectId)
    });

    this.triggerWorker();
    return createdJobs;
  }

  /**
   * Enqueues a single segment for regeneration with high priority.
   */
  public async enqueueSingleSegment(
    projectId: string,
    segmentId: string,
    priority = 10
  ): Promise<TTSJob> {
    const segment = segmentRepository.getById(segmentId);
    if (!segment || segment.projectId !== projectId) {
      throw new Error(`Segment ${segmentId} not found in project ${projectId}.`);
    }

    segmentRepository.update(segment.id, {
      status: 'queued',
      errorCode: null,
      errorMessage: null
    });

    const now = new Date().toISOString();
    const job: TTSJob = {
      id: crypto.randomUUID(),
      projectId,
      segmentId: segment.id,
      jobType: 'segment_tts',
      providerId: segment.providerId || 'edge-tts',
      status: 'pending',
      priority,
      attempt: 0,
      maxAttempts: RetryPolicy.DEFAULT_MAX_ATTEMPTS,
      providerJobId: null,
      payload: {
        text: segment.text,
        voiceId: segment.voiceId,
        settings: segment.settings
      },
      result: null,
      availableAt: now,
      startedAt: null,
      heartbeatAt: null,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    };

    jobRepository.insert(job);

    logger.info(
      'queue:service',
      `Enqueued single segment regeneration job: segment ${segmentId} (priority ${priority})`
    );

    this.emit({
      type: 'queue:progress',
      projectId,
      status: this.getQueueStatus(projectId)
    });

    this.triggerWorker();
    return job;
  }

  public triggerWorker(): void {
    setImmediate(() => {
      this.processNext().catch((err) => {
        logger.error('queue:worker', 'Error in immediate worker processing', err);
      });
    });
  }

  /**
   * Main scheduling loop. Picks pending jobs respecting per-provider concurrency.
   */
  public async processNext(): Promise<void> {
    if (this.isPaused || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Calculate current running count per provider
      const runningCount: Record<ProviderId, number> = {
        'edge-tts': 0,
        lucylab: 0,
        elevenlabs: 0,
        vbee: 0
      };

      for (const activeJob of this.activeJobs.values()) {
        if (activeJob.providerId in runningCount) {
          runningCount[activeJob.providerId]++;
        }
      }

      // Query top pending jobs
      const pendingCandidates = jobRepository.getPendingJobs(20);
      if (pendingCandidates.length === 0) {
        return;
      }

      for (const job of pendingCandidates) {
        if (this.activeJobs.has(job.id)) {
          continue;
        }

        const maxConc = this.providerConcurrency[job.providerId] ?? 1;
        const currentCount = runningCount[job.providerId] ?? 0;

        if (currentCount < maxConc) {
          runningCount[job.providerId] = currentCount + 1;
          // Spawn execution asynchronously
          this.executeJob(job).catch((err) => {
            logger.error('queue:exec', `Failed executing job ${job.id}`, err);
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Executes a single TTS job.
   */
  private async executeJob(job: TTSJob): Promise<void> {
    this.activeJobs.set(job.id, job);

    const now = new Date().toISOString();
    jobRepository.update(job.id, {
      status: 'running',
      startedAt: now,
      heartbeatAt: now
    });

    if (job.segmentId) {
      segmentRepository.update(job.segmentId, {
        status: 'processing'
      });
    }

    this.emit({
      type: 'job:started',
      job: { ...job, status: 'running', startedAt: now },
      projectId: job.projectId,
      status: this.getQueueStatus(job.projectId)
    });

    try {
      if (job.jobType === 'segment_tts') {
        await this.handleSegmentTTSJob(job);
      } else {
        throw new Error(`Unsupported jobType: ${job.jobType}`);
      }

      const completedAt = new Date().toISOString();
      const updatedJob = jobRepository.update(job.id, {
        status: 'completed',
        completedAt
      });

      this.emit({
        type: 'job:completed',
        job: updatedJob || undefined,
        projectId: job.projectId,
        status: this.getQueueStatus(job.projectId)
      });
    } catch (err: unknown) {
      await this.handleJobError(job, err);
    } finally {
      this.activeJobs.delete(job.id);
      this.triggerWorker();
    }
  }

  private async handleSegmentTTSJob(job: TTSJob): Promise<void> {
    if (!job.segmentId) {
      throw new Error(`Job ${job.id} is missing segmentId.`);
    }

    const segment = segmentRepository.getById(job.segmentId);
    if (!segment) {
      throw new Error(`Segment ${job.segmentId} not found.`);
    }

    const provider = providerRegistry.getProvider(job.providerId);
    const textToSynthesize = (job.payload.text as string) || segment.text;
    const voiceId = (job.payload.voiceId as string) || segment.voiceId || 'vi-VN-HoaiMyNeural';
    const settings = (job.payload.settings as VoiceSettings) || segment.settings;

    logger.info(
      'queue:tts',
      `Synthesizing segment ${segment.id} with ${job.providerId}:${voiceId} (${textToSynthesize.length} chars)`
    );

    const synthResult = await provider.synthesize({
      text: textToSynthesize,
      voiceId,
      settings
    });

    const generationId = crypto.randomUUID();
    const saveResult = await audioStorageService.saveSegmentAudio(
      job.projectId,
      segment.id,
      generationId,
      synthResult.audioBuffer,
      synthResult.format || 'mp3',
      {
        providerId: job.providerId,
        voiceId,
        settings,
        generatedAt: new Date().toISOString(),
        requestId: synthResult.requestId
      },
      synthResult.timings
    );

    // Calculate duration in integer ms
    let durationMs = 0;
    try {
      const probe = await ffprobeService.probeAudio(saveResult.filePath);
      durationMs = probe.durationMs;
    } catch {
      // Fallback estimate for standard MP3 128kbps if probe fails
      durationMs = Math.round((synthResult.audioBuffer.length * 8) / 128);
    }

    // Update segment with new audio non-destructively
    segmentRepository.update(segment.id, {
      status: 'completed',
      audioPath: saveResult.filePath,
      timingPath: saveResult.timingPath || null,
      durationMs,
      generationId,
      completedAt: new Date().toISOString(),
      errorCode: null,
      errorMessage: null
    });

    jobRepository.update(job.id, {
      result: {
        audioPath: saveResult.filePath,
        durationMs,
        sizeBytes: saveResult.sizeBytes,
        generationId
      }
    });

    logger.info(
      'queue:tts',
      `Segment ${segment.id} audio ready: ${saveResult.filePath} (${durationMs}ms)`
    );
  }

  private async handleJobError(job: TTSJob, err: unknown): Promise<void> {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode = (err as { code?: string })?.code || 'TTS_ERROR';
    const nextAttempt = job.attempt + 1;
    const retryable = RetryPolicy.isRetryable(err) && nextAttempt < job.maxAttempts;

    logger.warn(
      'queue:error',
      `Job ${job.id} failed (attempt ${job.attempt + 1}/${job.maxAttempts}): ${errorMsg}`
    );

    if (retryable) {
      const delayMs = RetryPolicy.calculateBackoffMs(nextAttempt);
      const availableAt = new Date(Date.now() + delayMs).toISOString();

      const updated = jobRepository.update(job.id, {
        status: 'retry_wait',
        attempt: nextAttempt,
        availableAt,
        errorCode,
        errorMessage: errorMsg
      });

      this.emit({
        type: 'job:updated',
        job: updated || undefined,
        projectId: job.projectId,
        status: this.getQueueStatus(job.projectId)
      });
    } else {
      const updated = jobRepository.update(job.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        attempt: nextAttempt,
        errorCode,
        errorMessage: errorMsg
      });

      if (job.segmentId) {
        segmentRepository.update(job.segmentId, {
          status: 'failed',
          errorCode,
          errorMessage: errorMsg
        });
      }

      this.emit({
        type: 'job:failed',
        job: updated || undefined,
        projectId: job.projectId,
        status: this.getQueueStatus(job.projectId)
      });
    }
  }

  public pauseQueue(): void {
    this.isPaused = true;
    logger.info('queue:service', 'Queue paused.');
    this.emit({
      type: 'queue:paused',
      status: this.getQueueStatus()
    });
  }

  public resumeQueue(): void {
    this.isPaused = false;
    logger.info('queue:service', 'Queue resumed.');
    this.emit({
      type: 'queue:resumed',
      status: this.getQueueStatus()
    });
    this.triggerWorker();
  }

  public cancelPendingJobs(projectId: string): number {
    const cancelledCount = jobRepository.cancelPendingJobs(projectId);

    // Reset any queued segments back to pending
    const segments = segmentRepository.listByProject(projectId);
    for (const seg of segments) {
      if (seg.status === 'queued') {
        segmentRepository.update(seg.id, { status: 'pending' });
      }
    }

    logger.info(
      'queue:service',
      `Cancelled ${cancelledCount} pending/retry job(s) for project ${projectId}`
    );

    this.emit({
      type: 'queue:progress',
      projectId,
      status: this.getQueueStatus(projectId)
    });

    return cancelledCount;
  }

  public getQueueStatus(projectId?: string): QueueStatus {
    const counts = projectId
      ? jobRepository.countByStatus(projectId)
      : { pending: 0, running: 0, completed: 0, failed: 0, retry_wait: 0, cancelled: 0, interrupted: 0 };

    return {
      isPaused: this.isPaused,
      isRunning: this.activeJobs.size > 0,
      activeJobCount: this.activeJobs.size,
      pendingJobCount: counts.pending + counts.retry_wait,
      completedJobCount: counts.completed,
      failedJobCount: counts.failed,
      totalJobCount:
        counts.pending +
        counts.retry_wait +
        counts.running +
        counts.completed +
        counts.failed +
        counts.cancelled +
        counts.interrupted
    };
  }
}

export const jobQueueService = new JobQueueService();
