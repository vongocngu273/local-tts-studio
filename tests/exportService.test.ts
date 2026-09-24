import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { projectRepository } from '../src/main/database/repositories/project.repository';
import { segmentRepository } from '../src/main/database/repositories/segment.repository';
import { audioCompositionService } from '../src/main/services/composition/audioComposition.service';
import { exportService } from '../src/main/services/export/export.service';
import { DEFAULT_COMPOSITION_SETTINGS } from '../src/shared/types/composition.types';
import type { Project } from '../src/shared/types/project.types';
import type { ProjectSegment } from '../src/shared/types/segment.types';
import type { AudioComposition } from '../src/shared/types/composition.types';

describe('ExportService', () => {
  let tempBaseDir: string;
  let exportTargetDir: string;
  let dummyAudioDir: string;

  const projectId = 'proj-export-test-1';
  let mockProject: Project;
  let mockComposition: AudioComposition;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-export-test-'));
    exportTargetDir = path.join(tempBaseDir, 'exports', 'bundle-out');
    dummyAudioDir = path.join(tempBaseDir, 'audio-fixtures');
    fs.mkdirSync(dummyAudioDir, { recursive: true });

    const now = new Date().toISOString();
    mockProject = {
      id: projectId,
      name: 'Bản Tin Thời Sự Export',
      description: 'Dự án kiểm tra chức năng xuất bản dữ liệu',
      status: 'completed',
      originalText: 'Đoạn một của bản tin thời sự. Đoạn hai với nội dung tiếp theo.',
      processedText: 'Đoạn một của bản tin thời sự. Đoạn hai với nội dung tiếp theo.',
      providerId: 'edge-tts',
      voiceId: 'vi-VN-HoaiMyNeural',
      settings: {
        version: 1,
        textProcessing: {
          dictionaryEnabled: true,
          whitespaceNormalization: true,
          dateNormalization: true,
          numberNormalization: true,
          currencyNormalization: true,
          abbreviationNormalization: true,
          providerContext: 'ALL',
          processorVersion: 1,
          processedFromRevision: 1,
          processedWithDictionaryRevision: 1
        }
      },
      projectPath: path.join(tempBaseDir, 'projects', projectId),
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      deletedAt: null
    };

    const compMp3Path = path.join(dummyAudioDir, 'full_composition.mp3');
    fs.writeFileSync(compMp3Path, 'mock-full-mp3-binary-content-12345');

    mockComposition = {
      id: 'comp-1',
      projectId,
      sourceFingerprint: 'dummy-fingerprint-abc',
      segmentCount: 2,
      outputMp3Path: compMp3Path,
      outputWavPath: null,
      durationMs: 65000, // 1m 5s -> 01:05
      sizeBytes: 1024,
      settings: DEFAULT_COMPOSITION_SETTINGS,
      status: 'completed',
      createdAt: now,
      completedAt: now
    };

    vi.spyOn(projectRepository, 'findById').mockImplementation((id: string) => {
      if (id === projectId) return mockProject;
      return null;
    });

    vi.spyOn(audioCompositionService, 'getLatestComposition').mockImplementation((id: string) => {
      if (id === projectId) return mockComposition;
      return null;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('exports individual segments and rich markdown manifest when options are enabled', async () => {
    // Create dummy segment audio files
    const seg1AudioPath = path.join(dummyAudioDir, 'seg1.mp3');
    const seg2AudioPath = path.join(dummyAudioDir, 'seg2.mp3');
    fs.writeFileSync(seg1AudioPath, 'segment-one-audio-content');
    fs.writeFileSync(seg2AudioPath, 'segment-two-audio-content');

    const now = new Date().toISOString();
    const mockSegments: ProjectSegment[] = [
      {
        id: 'seg-1',
        projectId,
        segmentIndex: 0,
        text: 'Đoạn một của bản tin thời sự sáng nay.',
        textHash: 'hash-1',
        baseText: 'Đoạn một của bản tin thời sự sáng nay.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 0,
        sourceEnd: 38,
        paragraphIndex: 0,
        status: 'completed',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: { speed: 1.0, pitch: 0, volume: 100 },
        generationId: null,
        audioPath: seg1AudioPath,
        timingPath: null,
        durationMs: 32000,
        characterCount: 38,
        pauseAfterMs: 250,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        completedAt: now
      },
      {
        id: 'seg-2',
        projectId,
        segmentIndex: 1,
        text: 'Đoạn hai với nội dung tiếp theo và chi tiết hơn.',
        textHash: 'hash-2',
        baseText: 'Đoạn hai với nội dung tiếp theo và chi tiết hơn.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 39,
        sourceEnd: 86,
        paragraphIndex: 0,
        status: 'completed',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: { speed: 1.0, pitch: 0, volume: 100 },
        generationId: null,
        audioPath: seg2AudioPath,
        timingPath: null,
        durationMs: 33000,
        characterCount: 47,
        pauseAfterMs: 400,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        completedAt: now
      }
    ];

    vi.spyOn(segmentRepository, 'listByProject').mockReturnValue(mockSegments);

    // Execute export
    const result = await exportService.exportProjectBundle(projectId, exportTargetDir, {
      includeMp3: true,
      includeWav: false,
      includeSrt: false,
      includeVtt: false,
      includeScriptOriginal: true,
      includeScriptProcessed: true,
      includeProjectJson: true,
      includeIndividualSegments: true,
      includeMarkdownManifest: true
    });

    // Assert bundle return structure
    expect(result.targetDirectory).toBe(exportTargetDir);
    expect(result.totalSizeBytes).toBeGreaterThan(0);
    expect(result.exportedFiles.length).toBeGreaterThan(0);

    for (const exportedFile of result.exportedFiles) {
      expect(fs.existsSync(exportedFile)).toBe(true);
    }

    // Verify segments directory and files
    const segDir = path.join(exportTargetDir, 'segments');
    expect(fs.existsSync(segDir)).toBe(true);

    const seg1Dest = path.join(segDir, '001_segment.mp3');
    const seg2Dest = path.join(segDir, '002_segment.mp3');
    expect(fs.existsSync(seg1Dest)).toBe(true);
    expect(fs.existsSync(seg2Dest)).toBe(true);

    expect(fs.readFileSync(seg1Dest, 'utf-8')).toBe('segment-one-audio-content');
    expect(fs.readFileSync(seg2Dest, 'utf-8')).toBe('segment-two-audio-content');

    expect(result.exportedFiles).toContain(seg1Dest);
    expect(result.exportedFiles).toContain(seg2Dest);

    // Verify manifest.md
    const manifestPath = path.join(exportTargetDir, 'manifest.md');
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(result.exportedFiles).toContain(manifestPath);

    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    expect(manifestContent).toContain(`# Project Export Manifest: ${mockProject.name}`);
    expect(manifestContent).toContain(`Project ID | ${mockProject.id}`);
    expect(manifestContent).toContain(`Status | ${mockProject.status}`);
    expect(manifestContent).toContain(`Provider | ${mockProject.providerId}`);
    expect(manifestContent).toContain(`Voice | ${mockProject.voiceId}`);
    expect(manifestContent).toContain('Total Segments | 2');
    expect(manifestContent).toContain('Composition Duration | 01:05');
    expect(manifestContent).toContain('Export Timestamp |');

    // Verify timeline table
    expect(manifestContent).toContain('| Index | Text snippet | Duration (ms) | Pause (ms) | Status |');
    expect(manifestContent).toContain('| 1 | Đoạn một của bản tin thời sự sáng nay. | 32000 | 250 | completed |');
    expect(manifestContent).toContain('| 2 | Đoạn hai với nội dung tiếp theo và chi tiết hơn. | 33000 | 400 | completed |');
  });

  it('omits segments and manifest when options are set to false', async () => {
    vi.spyOn(segmentRepository, 'listByProject').mockReturnValue([]);

    const result = await exportService.exportProjectBundle(projectId, exportTargetDir, {
      includeMp3: true,
      includeWav: false,
      includeSrt: false,
      includeVtt: false,
      includeScriptOriginal: false,
      includeScriptProcessed: false,
      includeProjectJson: false,
      includeIndividualSegments: false,
      includeMarkdownManifest: false
    });

    const segDir = path.join(exportTargetDir, 'segments');
    const manifestPath = path.join(exportTargetDir, 'manifest.md');

    expect(fs.existsSync(segDir)).toBe(false);
    expect(fs.existsSync(manifestPath)).toBe(false);
    expect(result.exportedFiles).not.toContain(manifestPath);
  });

  it('truncates snippet to 60 characters and sanitizes pipe characters in manifest table', async () => {
    const longTextWithPipe = 'This is a very long text segment that exceeds sixty characters easily | with a pipe symbol and more text.';
    const now = new Date().toISOString();
    const singleSegment: ProjectSegment = {
      id: 'seg-long',
      projectId,
      segmentIndex: 0,
      text: longTextWithPipe,
      textHash: 'hash-long',
      baseText: longTextWithPipe,
      overrideText: null,
      hasOverride: false,
      sourceStart: 0,
      sourceEnd: longTextWithPipe.length,
      paragraphIndex: 0,
      status: 'completed',
      providerId: 'edge-tts',
      voiceId: 'vi-VN-HoaiMyNeural',
      modelId: null,
      settings: { speed: 1.0, pitch: 0, volume: 100 },
      generationId: null,
      audioPath: null,
      timingPath: null,
      durationMs: 2000,
      characterCount: longTextWithPipe.length,
      pauseAfterMs: 150,
      errorCode: null,
      errorMessage: null,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      completedAt: now
    };

    vi.spyOn(segmentRepository, 'listByProject').mockReturnValue([singleSegment]);

    await exportService.exportProjectBundle(projectId, exportTargetDir, {
      includeMp3: false,
      includeWav: false,
      includeSrt: false,
      includeVtt: false,
      includeProjectJson: false,
      includeIndividualSegments: false,
      includeMarkdownManifest: true
    });

    const manifestPath = path.join(exportTargetDir, 'manifest.md');
    const content = fs.readFileSync(manifestPath, 'utf-8');

    const expectedSnippet = longTextWithPipe.slice(0, 60);
    expect(expectedSnippet.length).toBe(60);
    expect(content).toContain(expectedSnippet);
  });
});
