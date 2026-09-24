import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { databaseService } from '../src/main/database/database.service';
import { projectRepository } from '../src/main/database/repositories/project.repository';
import { segmentRepository } from '../src/main/database/repositories/segment.repository';
import { jobRepository } from '../src/main/database/repositories/job.repository';
import { jobQueueService } from '../src/main/services/job-queue/jobQueue.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { ProjectSegment } from '../src/shared/types/segment.types';

describe('JobQueueService', () => {
  let projectId: string;

  beforeAll(() => {
    projectId = `test_queue_proj_${Date.now()}`;
    const testUserData = path.join(__dirname, '..', `tmp_test_queue_${Date.now()}`);
    appPathsService.initialize(testUserData);
    databaseService.initialize();

    // Create test project
    projectRepository.insert({
      id: projectId,
      name: 'Queue Test Project',
      description: null,
      status: 'draft',
      originalText: 'Đoạn 1. Đoạn 2.',
      processedText: 'Đoạn 1. Đoạn 2.',
      providerId: 'edge-tts',
      voiceId: 'vi-VN-HoaiMyNeural',
      settings: { version: 1 },
      projectPath: '/tmp/test_queue_project',
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      deletedAt: null
    });

    // Create 2 segments
    const segments: ProjectSegment[] = [
      {
        id: 'seg-q1',
        projectId,
        segmentIndex: 0,
        text: 'Đoạn 1.',
        textHash: 'hash1',
        baseText: 'Đoạn 1.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 0,
        sourceEnd: 7,
        paragraphIndex: 0,
        status: 'pending',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: {},
        generationId: null,
        audioPath: null,
        timingPath: null,
        durationMs: null,
        characterCount: 7,
        pauseAfterMs: 250,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null
      },
      {
        id: 'seg-q2',
        projectId,
        segmentIndex: 1,
        text: 'Đoạn 2.',
        textHash: 'hash2',
        baseText: 'Đoạn 2.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 8,
        sourceEnd: 15,
        paragraphIndex: 0,
        status: 'pending',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: {},
        generationId: null,
        audioPath: null,
        timingPath: null,
        durationMs: null,
        characterCount: 7,
        pauseAfterMs: 250,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null
      }
    ];

    segmentRepository.insertBatch(segments);
    // Pause queue initially so jobs don't execute automatically during insertion tests
    jobQueueService.pauseQueue();
  });

  afterAll(() => {
    jobQueueService.stopTimers();
  });

  it('enqueues eligible segments into SQLite job table', async () => {
    const jobs = await jobQueueService.enqueueSegments(projectId);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].status).toBe('pending');
    expect(jobs[0].jobType).toBe('segment_tts');
    expect(jobs[0].segmentId).toBe('seg-q1');

    const seg1 = segmentRepository.getById('seg-q1');
    expect(seg1?.status).toBe('queued');

    const status = jobQueueService.getQueueStatus(projectId);
    expect(status.pendingJobCount).toBe(2);
  });

  it('enqueues single segment with high priority for targeted regeneration', async () => {
    const singleJob = await jobQueueService.enqueueSingleSegment(projectId, 'seg-q2', 15);
    expect(singleJob.segmentId).toBe('seg-q2');
    expect(singleJob.priority).toBe(15);

    const pending = jobRepository.getPendingJobs();
    expect(pending[0].id).toBe(singleJob.id); // Higher priority appears first
  });

  it('cancels pending jobs without affecting completed segments', () => {
    const cancelled = jobQueueService.cancelPendingJobs(projectId);
    expect(cancelled).toBeGreaterThanOrEqual(2);

    const seg1 = segmentRepository.getById('seg-q1');
    expect(seg1?.status).toBe('pending');

    const status = jobQueueService.getQueueStatus(projectId);
    expect(status.pendingJobCount).toBe(0);
  });

  it('pauses and resumes queue state', () => {
    jobQueueService.resumeQueue();
    expect(jobQueueService.getQueueStatus().isPaused).toBe(false);

    jobQueueService.pauseQueue();
    expect(jobQueueService.getQueueStatus().isPaused).toBe(true);
  });
});
