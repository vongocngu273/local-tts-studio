import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { segmentEngine } from '../src/main/services/segmentation/segmentEngine';
import { projectRepository } from '../src/main/database/repositories/project.repository';
import { segmentRepository } from '../src/main/database/repositories/segment.repository';
import { appMetadataRepository } from '../src/main/database/repositories/appMetadata.repository';
import type { Project, ProjectSettings } from '../src/shared/types/project.types';

describe('SegmentEngine Audio Reuse', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-reuse-test-'));
    appPathsService.initialize(tempBaseDir);
    const dbFilePath = path.join(tempBaseDir, 'database', 'test-reuse.db');
    const backupDir = path.join(tempBaseDir, 'backups');
    databaseService.initialize(dbFilePath, backupDir);
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should reuse completed audio for unchanged segments when rebuilding', async () => {
    const dictRev = appMetadataRepository.getDictionaryRevision();
    const settings: ProjectSettings = {
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
        processedWithDictionaryRevision: dictRev
      }
    };

    const paragraphs = [
      'Đoạn văn số 1: Giới thiệu chung về hệ thống.',
      'Đoạn văn số 2: Các tính năng cốt lõi của ứng dụng.',
      'Đoạn văn số 3: Đoạn văn sẽ bị chỉnh sửa sau này.',
      'Đoạn văn số 4: Hiệu năng và độ tin cậy cao.',
      'Đoạn văn số 5: Kết luận và lời cảm ơn.'
    ];

    const initialScript = paragraphs.join('\n\n');

    const project: Project = {
      id: 'proj-reuse-1',
      name: 'Reuse Project',
      description: null,
      status: 'ready',
      originalText: initialScript,
      processedText: initialScript,
      providerId: 'edge-tts',
      voiceId: 'vi-VN-HoaiMyNeural',
      settings,
      projectPath: path.join(tempBaseDir, 'projects', 'proj-reuse-1'),
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: null
    };

    projectRepository.insert(project);

    // Initial build
    const initialResult = await segmentEngine.buildSegments({
      projectId: project.id,
      profile: { targetCharacters: 100, maxCharacters: 300, minCharacters: 20 }
    });

    expect(initialResult.totalSegments).toBe(5);
    expect(initialResult.newSegments).toBe(5);
    expect(initialResult.reusedSegments).toBe(0);

    // Simulate completion of all 5 segments with audio files
    const segments = segmentRepository.listByProject(project.id);
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const audioFakePath = path.join(tempBaseDir, `audio_${i}.mp3`);
      fs.writeFileSync(audioFakePath, 'FAKE_AUDIO');

      segmentRepository.update(seg.id, {
        status: 'completed',
        audioPath: audioFakePath,
        generationId: `gen-${i}`,
        durationMs: 3000 + i * 500,
        completedAt: new Date().toISOString()
      });
    }

    // Now edit paragraph 3 only in the script
    const modifiedParagraphs = [...paragraphs];
    modifiedParagraphs[2] = 'Đoạn văn số 3 ĐÃ ĐƯỢC CHỈNH SỬA NỘI DUNG HOÀN TOÀN MỚI.';
    const updatedScript = modifiedParagraphs.join('\n\n');

    // Update project processed text & bump revision
    projectRepository.update(project.id, {
      originalText: updatedScript,
      processedText: updatedScript,
      revision: 2,
      settings: {
        ...settings,
        textProcessing: {
          ...settings.textProcessing!,
          processedFromRevision: 2
        }
      }
    });

    // Rebuild segments
    const rebuildResult = await segmentEngine.buildSegments({
      projectId: project.id,
      profile: { targetCharacters: 100, maxCharacters: 300, minCharacters: 20 }
    });

    expect(rebuildResult.totalSegments).toBe(5);
    expect(rebuildResult.reusedSegments).toBe(4); // 4 unchanged segments reused!
    expect(rebuildResult.newSegments).toBe(1); // Only modified paragraph 3 is pending!

    const updatedSegments = segmentRepository.listByProject(project.id);
    expect(updatedSegments[0].status).toBe('completed');
    expect(updatedSegments[1].status).toBe('completed');
    expect(updatedSegments[2].status).toBe('pending');
    expect(updatedSegments[3].status).toBe('completed');
    expect(updatedSegments[4].status).toBe('completed');

    // Verify reused segments kept their generationId and audioPath
    expect(updatedSegments[0].audioPath).toBe(path.join(tempBaseDir, 'audio_0.mp3'));
    expect(updatedSegments[3].audioPath).toBe(path.join(tempBaseDir, 'audio_3.mp3'));
  });
});
