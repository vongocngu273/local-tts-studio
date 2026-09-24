import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { paragraphSplitter } from '../src/main/services/segmentation/paragraphSplitter';
import { sentenceSplitter } from '../src/main/services/segmentation/sentenceSplitter';
import { segmentOptimizer } from '../src/main/services/segmentation/segmentOptimizer';
import { segmentEngine } from '../src/main/services/segmentation/segmentEngine';
import { projectRepository } from '../src/main/database/repositories/project.repository';
import { segmentRepository } from '../src/main/database/repositories/segment.repository';
import { appMetadataRepository } from '../src/main/database/repositories/appMetadata.repository';
import type { Project, ProjectSettings } from '../src/shared/types/project.types';

describe('SegmentEngine, Splitters & Optimization', () => {
  let tempBaseDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-seg-test-'));
    appPathsService.initialize(tempBaseDir);
    const dbFilePath = path.join(tempBaseDir, 'database', 'test-seg.db');
    const backupDir = path.join(tempBaseDir, 'backups');
    databaseService.initialize(dbFilePath, backupDir);
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should split text into paragraphs preserving paragraph index and character offsets', () => {
    const text = 'Đoạn thứ nhất gồm câu A.\n\nĐoạn thứ hai gồm câu B và câu C.\n\nĐoạn thứ ba.';
    const paragraphs = paragraphSplitter.split(text);

    expect(paragraphs.length).toBe(3);
    expect(paragraphs[0].paragraphIndex).toBe(0);
    expect(paragraphs[0].text).toBe('Đoạn thứ nhất gồm câu A.');
    expect(paragraphs[1].paragraphIndex).toBe(1);
    expect(paragraphs[1].text).toBe('Đoạn thứ hai gồm câu B và câu C.');
    expect(paragraphs[2].paragraphIndex).toBe(2);
    expect(paragraphs[2].text).toBe('Đoạn thứ ba.');

    // Verify exact offsets
    for (const p of paragraphs) {
      expect(text.slice(p.startIndex, p.endIndex)).toBe(p.text);
    }
  });

  it('should split sentences without breaking on Vietnamese abbreviations or document codes', () => {
    const text =
      'Ủy ban nhân dân TP.HCM vừa họp với P.GS Nguyễn Văn A. ' +
      'Nghị định số 70/2025/NĐ-CP đã được ban hành vào ngày hôm qua. ' +
      'Giá bán là 1.500 đồng một gói!';

    const para = {
      text,
      paragraphIndex: 0,
      startIndex: 0,
      endIndex: text.length
    };

    const sentences = sentenceSplitter.splitParagraph(para);

    expect(sentences.length).toBe(3);
    expect(sentences[0].text).toContain('TP.HCM');
    expect(sentences[0].text).toContain('P.GS');
    expect(sentences[1].text).toContain('70/2025/NĐ-CP');
    expect(sentences[2].text).toContain('1.500 đồng');
  });

  it('should merge short sentences within same paragraph up to targetCharacters', () => {
    const sentences = [
      { text: 'Câu số một.', paragraphIndex: 0, startIndex: 0, endIndex: 11 },
      { text: 'Câu số hai.', paragraphIndex: 0, startIndex: 12, endIndex: 23 },
      { text: 'Câu số ba.', paragraphIndex: 0, startIndex: 24, endIndex: 34 }
    ];

    const optimized = segmentOptimizer.optimize(sentences, {
      targetCharacters: 200,
      maxCharacters: 500,
      minCharacters: 50
    });

    expect(optimized.length).toBe(1);
    expect(optimized[0].text).toBe('Câu số một. Câu số hai. Câu số ba.');
    expect(optimized[0].paragraphIndex).toBe(0);
    expect(optimized[0].sourceStart).toBe(0);
    expect(optimized[0].sourceEnd).toBe(34);
  });

  it('should not merge sentences across different paragraphs', () => {
    const sentences = [
      { text: 'Đoạn 1 câu ngắn.', paragraphIndex: 0, startIndex: 0, endIndex: 16 },
      { text: 'Đoạn 2 câu ngắn.', paragraphIndex: 1, startIndex: 18, endIndex: 34 }
    ];

    const optimized = segmentOptimizer.optimize(sentences, {
      targetCharacters: 500,
      maxCharacters: 1000,
      minCharacters: 100
    });

    expect(optimized.length).toBe(2);
    expect(optimized[0].paragraphIndex).toBe(0);
    expect(optimized[1].paragraphIndex).toBe(1);
  });

  it('should split oversized sentences exceeding maxCharacters', () => {
    const longSentence =
      'Phần thứ nhất của câu rất dài; phần thứ hai cũng rất dài và có nhiều thông tin; phần thứ ba bổ sung thêm chi tiết quan trọng.';

    const sentences = [
      {
        text: longSentence,
        paragraphIndex: 0,
        startIndex: 0,
        endIndex: longSentence.length
      }
    ];

    const optimized = segmentOptimizer.optimize(sentences, {
      targetCharacters: 60,
      maxCharacters: 70,
      minCharacters: 20
    });

    expect(optimized.length).toBeGreaterThan(1);
    for (const seg of optimized) {
      expect(seg.characterCount).toBeLessThanOrEqual(70);
    }
  });

  it('should reject building segments if processed_text is missing or stale', async () => {
    const project: Project = {
      id: 'proj-seg-test-1',
      name: 'Unprocessed Project',
      description: null,
      status: 'draft',
      originalText: 'Original text',
      processedText: '',
      providerId: 'edge-tts',
      voiceId: 'vi-VN-HoaiMyNeural',
      settings: { version: 1 },
      projectPath: path.join(tempBaseDir, 'projects', 'proj-seg-test-1'),
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: null
    };

    projectRepository.insert(project);

    await expect(
      segmentEngine.buildSegments({ projectId: project.id })
    ).rejects.toThrow(/NO_PROCESSED_TEXT/);
  });

  it('should produce deterministic segments and calculate source ranges correctly', async () => {
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

    const script =
      'Hà Nội là thủ đô của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.\n\n' +
      'Thành phố có bề dày lịch sử nghìn năm văn hiến, với nhiều di tích lịch sử nổi tiếng.';

    const project: Project = {
      id: 'proj-seg-test-2',
      name: 'Hanoi Project',
      description: null,
      status: 'ready',
      originalText: script,
      processedText: script,
      providerId: 'edge-tts',
      voiceId: 'vi-VN-HoaiMyNeural',
      settings,
      projectPath: path.join(tempBaseDir, 'projects', 'proj-seg-test-2'),
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: null
    };

    projectRepository.insert(project);

    const result = await segmentEngine.buildSegments({
      projectId: project.id,
      profile: { targetCharacters: 300, maxCharacters: 500, minCharacters: 50 }
    });

    expect(result.totalSegments).toBe(2);
    expect(result.newSegments).toBe(2);
    expect(result.reusedSegments).toBe(0);

    const saved = segmentRepository.listByProject(project.id);
    expect(saved.length).toBe(2);
    expect(saved[0].paragraphIndex).toBe(0);
    expect(saved[1].paragraphIndex).toBe(1);

    // Verify source range matches exact text in script
    for (const seg of saved) {
      expect(script.slice(seg.sourceStart, seg.sourceEnd)).toBe(seg.text);
    }
  });
});
