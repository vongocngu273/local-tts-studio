import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { projectRepository } from '../src/main/database/repositories/project.repository';
import { segmentRepository } from '../src/main/database/repositories/segment.repository';
import { audioCompositionService } from '../src/main/services/composition/audioComposition.service';
import { subtitleService } from '../src/main/services/subtitles/subtitle.service';
import { ffmpegBinaryService } from '../src/main/services/ffmpeg/ffmpegBinary.service';
import { exportService } from '../src/main/services/export/export.service';
import { DEFAULT_COMPOSITION_SETTINGS } from '../src/shared/types/composition.types';
import type { Project } from '../src/shared/types/project.types';
import type { ProjectSegment } from '../src/shared/types/segment.types';
import type { AudioComposition } from '../src/shared/types/composition.types';

describe('QA Export & UI Verification Test Suite (TC-20260923-EXPORT-AND-UI-FIX)', () => {
  let tempBaseDir: string;
  let exportTargetDir: string;
  let dummyAudioDir: string;

  const projectId = 'qa-proj-export-master';
  let mockProject: Project;
  let mockComposition: AudioComposition;
  let compMp3Path: string;
  let seg1AudioPath: string;
  let seg2AudioPath: string;

  beforeEach(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-export-test-'));
    exportTargetDir = path.join(tempBaseDir, 'exports', 'bundle-all');
    dummyAudioDir = path.join(tempBaseDir, 'audio-fixtures');
    fs.mkdirSync(dummyAudioDir, { recursive: true });

    compMp3Path = path.join(dummyAudioDir, 'mock_comp.mp3');
    seg1AudioPath = path.join(dummyAudioDir, 'seg1.mp3');
    seg2AudioPath = path.join(dummyAudioDir, 'seg2.mp3');

    // Generate valid 1-second audio files with ffmpeg
    const ffmpegPath = ffmpegBinaryService.resolveFFmpegPath() || 'ffmpeg';
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ffmpegPath,
        ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-b:a', '128k', compMp3Path],
        { shell: false, windowsHide: true }
      );
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg error ${code}`))));
      child.on('error', reject);
    });

    fs.copyFileSync(compMp3Path, seg1AudioPath);
    fs.copyFileSync(compMp3Path, seg2AudioPath);

    const now = new Date().toISOString();
    mockProject = {
      id: projectId,
      name: 'Bản Tin Thời Sự Đặc Biệt 2026',
      description: 'Dự án QA kiểm tra tất cả 9 tùy chọn và các ca biên',
      status: 'completed',
      originalText: 'Bản tin thời sự đặc biệt hôm nay.\nDòng thứ hai của kịch bản phát thanh.',
      processedText: 'Bản tin thời sự đặc biệt hôm nay đã chuẩn hóa.\nDòng thứ hai của kịch bản phát thanh đã chuẩn hóa.',
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

    mockComposition = {
      id: 'comp-qa-1',
      projectId,
      sourceFingerprint: 'mock-fingerprint-qa-123',
      segmentCount: 2,
      outputMp3Path: compMp3Path,
      outputWavPath: null,
      durationMs: 75000, // 01:15
      sizeBytes: 16384,
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

    vi.spyOn(subtitleService, 'exportSubtitles').mockImplementation(async (_id: string, format?: string) => {
      const fmt = (format || 'srt') as 'srt' | 'vtt';
      const subPath = path.join(tempBaseDir, `mock-subtitle.${fmt}`);
      const content =
        fmt === 'srt'
          ? '1\n00:00:00,000 --> 00:00:01,000\nBản tin thời sự đặc biệt hôm nay.'
          : 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nBản tin thời sự đặc biệt hôm nay.';
      fs.writeFileSync(subPath, content, 'utf-8');
      return {
        filePath: subPath,
        cueCount: 1,
        format: fmt
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 1. Full Export Bundle Flow with all 9 options enabled
  // --------------------------------------------------------------------------
  it('executes full export bundle flow with all 9 options enabled successfully', async () => {
    const now = new Date().toISOString();
    const mockSegments: ProjectSegment[] = [
      {
        id: 'seg-1',
        projectId,
        segmentIndex: 0,
        text: 'Bản tin thời sự đặc biệt hôm nay.',
        textHash: 'hash-seg-1',
        baseText: 'Bản tin thời sự đặc biệt hôm nay.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 0,
        sourceEnd: 33,
        paragraphIndex: 0,
        status: 'completed',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: { speed: 1.0, pitch: 0, volume: 100 },
        generationId: null,
        audioPath: seg1AudioPath,
        timingPath: null,
        durationMs: 35000,
        characterCount: 33,
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
        text: 'Dòng thứ hai của kịch bản phát thanh.',
        textHash: 'hash-seg-2',
        baseText: 'Dòng thứ hai của kịch bản phát thanh.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 34,
        sourceEnd: 71,
        paragraphIndex: 0,
        status: 'completed',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: { speed: 1.0, pitch: 0, volume: 100 },
        generationId: null,
        audioPath: seg2AudioPath,
        timingPath: null,
        durationMs: 40000,
        characterCount: 37,
        pauseAfterMs: 600,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        completedAt: now
      }
    ];

    vi.spyOn(segmentRepository, 'listByProject').mockReturnValue(mockSegments);

    const result = await exportService.exportProjectBundle(projectId, exportTargetDir, {
      includeIndividualSegments: true,
      includeMarkdownManifest: true,
      includeMp3: true,
      includeWav: true,
      includeSrt: true,
      includeVtt: true,
      includeScriptOriginal: true,
      includeScriptProcessed: true,
      includeProjectJson: true
    });

    expect(result.targetDirectory).toBe(exportTargetDir);
    expect(result.totalSizeBytes).toBeGreaterThan(0);

    // Verify all 9 options created their expected files
    const expectedFiles = [
      path.join(exportTargetDir, 'audio.mp3'),
      path.join(exportTargetDir, 'audio.wav'),
      path.join(exportTargetDir, 'segments', '001_segment.mp3'),
      path.join(exportTargetDir, 'segments', '002_segment.mp3'),
      path.join(exportTargetDir, 'subtitle.srt'),
      path.join(exportTargetDir, 'subtitle.vtt'),
      path.join(exportTargetDir, 'script-original.txt'),
      path.join(exportTargetDir, 'script-processed.txt'),
      path.join(exportTargetDir, 'project.json'),
      path.join(exportTargetDir, 'manifest.md')
    ];

    for (const file of expectedFiles) {
      expect(fs.existsSync(file), `Expected ${file} to exist`).toBe(true);
      expect(result.exportedFiles).toContain(file);
    }

    // Verify script files content
    expect(fs.readFileSync(path.join(exportTargetDir, 'script-original.txt'), 'utf-8')).toBe(mockProject.originalText);
    expect(fs.readFileSync(path.join(exportTargetDir, 'script-processed.txt'), 'utf-8')).toBe(mockProject.processedText);

    // Verify project.json content
    const projectJson = JSON.parse(fs.readFileSync(path.join(exportTargetDir, 'project.json'), 'utf-8'));
    expect(projectJson.project.id).toBe(projectId);
    expect(projectJson.project.name).toBe(mockProject.name);
    expect(projectJson.composition.durationMs).toBe(75000);
    expect(projectJson.segments).toHaveLength(2);
    expect(projectJson.segments[0].segmentIndex).toBe(0);
    expect(projectJson.segments[0].text).toBe(mockSegments[0].text);
  });

  // --------------------------------------------------------------------------
  // 2. Edge Case 1: Project with segments that have no audio generated yet
  // --------------------------------------------------------------------------
  it('edge case 1: project with segments having no audio generated yet should not crash', async () => {
    const now = new Date().toISOString();
    const pendingSegments: ProjectSegment[] = [
      {
        id: 'seg-pending-1',
        projectId,
        segmentIndex: 0,
        text: 'Đoạn phân đoạn đang chờ khởi tạo âm thanh.',
        textHash: 'hash-p1',
        baseText: 'Đoạn phân đoạn đang chờ khởi tạo âm thanh.',
        overrideText: null,
        hasOverride: false,
        sourceStart: 0,
        sourceEnd: 41,
        paragraphIndex: 0,
        status: 'pending',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: { speed: 1.0, pitch: 0, volume: 100 },
        generationId: null,
        audioPath: null,
        timingPath: null,
        durationMs: null,
        characterCount: 41,
        pauseAfterMs: 250,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        completedAt: null
      }
    ];

    vi.spyOn(segmentRepository, 'listByProject').mockReturnValue(pendingSegments);
    vi.spyOn(audioCompositionService, 'getLatestComposition').mockReturnValue(null);

    // When segments have no audio, exportProjectBundle must not crash,
    // should omit non-existent audio segments, and write manifest with proper pending status.
    const result = await exportService.exportProjectBundle(projectId, exportTargetDir, {
      includeIndividualSegments: true,
      includeMarkdownManifest: true,
      includeMp3: false,
      includeWav: false,
      includeSrt: false,
      includeVtt: false,
      includeScriptOriginal: true,
      includeScriptProcessed: true,
      includeProjectJson: true
    });

    expect(result).toBeDefined();

    // Verify segments/ directory was not created or has 0 audio files
    const segDir = path.join(exportTargetDir, 'segments');
    expect(fs.existsSync(segDir)).toBe(false);

    // Verify manifest.md exists and shows pending status
    const manifestPath = path.join(exportTargetDir, 'manifest.md');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    expect(manifestContent).toContain('pending');
    expect(manifestContent).toContain('Đoạn phân đoạn đang chờ khởi tạo âm thanh.');
  });

  // --------------------------------------------------------------------------
  // 3. Edge Case 2: Manifest content formatting, Vietnamese headings, duration, table sanitization
  // --------------------------------------------------------------------------
  it('edge case 2: verifies manifest.md content contains proper Vietnamese markdown headings, duration, and sanitized table rows', async () => {
    const vietnameseProjectName = 'Chương Trình Phát Thanh Tiếng Việt Đặc Sắc #1';
    const vietnameseMockProject: Project = {
      ...mockProject,
      name: vietnameseProjectName
    };
    vi.spyOn(projectRepository, 'findById').mockReturnValue(vietnameseMockProject);

    const longTextWithNewlinesAndPipes = 'Dòng đầu tiên của câu chuyện văn học | có chứa ký tự phân cách pipe và ngắt dòng\ntiếp tục phần thứ hai dài hơn sáu mươi ký tự để kiểm tra việc cắt gọt chuỗi.';
    const now = new Date().toISOString();
    const segmentsWithSpecialCharacters: ProjectSegment[] = [
      {
        id: 'seg-special-1',
        projectId,
        segmentIndex: 0,
        text: longTextWithNewlinesAndPipes,
        textHash: 'hash-special',
        baseText: longTextWithNewlinesAndPipes,
        overrideText: null,
        hasOverride: false,
        sourceStart: 0,
        sourceEnd: longTextWithNewlinesAndPipes.length,
        paragraphIndex: 0,
        status: 'completed',
        providerId: 'edge-tts',
        voiceId: 'vi-VN-HoaiMyNeural',
        modelId: null,
        settings: { speed: 1.0, pitch: 0, volume: 100 },
        generationId: null,
        audioPath: seg1AudioPath,
        timingPath: null,
        durationMs: 75000, // 01:15
        characterCount: longTextWithNewlinesAndPipes.length,
        pauseAfterMs: 300,
        errorCode: null,
        errorMessage: null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        completedAt: now
      }
    ];

    vi.spyOn(segmentRepository, 'listByProject').mockReturnValue(segmentsWithSpecialCharacters);

    await exportService.exportProjectBundle(projectId, exportTargetDir, {
      includeMp3: false,
      includeWav: false,
      includeSrt: false,
      includeVtt: false,
      includeIndividualSegments: false,
      includeMarkdownManifest: true
    });

    const manifestPath = path.join(exportTargetDir, 'manifest.md');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = fs.readFileSync(manifestPath, 'utf-8');

    // 1. Heading with full Vietnamese diacritics
    expect(content).toContain(`# Project Export Manifest: ${vietnameseProjectName}`);
    expect(content).toContain('## Metadata');
    expect(content).toContain('## Segment Timeline');

    // 2. Duration formatted correctly as MM:SS (75000ms -> 01:15)
    expect(content).toContain('Composition Duration | 01:15');

    // 3. Table row sanitization:
    // Raw newline (\n) in text should be replaced with space
    // Pipe (|) should be escaped (\ |)
    // Truncated to 60 characters
    const sanitizedSnippet = longTextWithNewlinesAndPipes
      .replace(/\r?\n/g, ' ')
      .slice(0, 60)
      .replace(/\|/g, '\\|');

    expect(content).toContain(`| 1 | ${sanitizedSnippet} | 75000 | 300 | completed |`);
    expect(sanitizedSnippet).not.toContain('\n');
    expect(sanitizedSnippet).toContain('\\|');
  });

  // --------------------------------------------------------------------------
  // 4. Edge Case 3: TextProcessingSettingsPanel and ExportPanel test IDs and truncate checks
  // --------------------------------------------------------------------------
  it('edge case 3: verifies text-processing toggle elements and export panel options have test IDs and no CSS truncate classes on hint text', () => {
    const tpPanelPath = path.resolve(__dirname, '../src/renderer/components/text-processing/TextProcessingSettingsPanel.tsx');
    const exportPanelPath = path.resolve(__dirname, '../src/renderer/components/export/ExportPanel.tsx');

    expect(fs.existsSync(tpPanelPath)).toBe(true);
    expect(fs.existsSync(exportPanelPath)).toBe(true);

    const tpSource = fs.readFileSync(tpPanelPath, 'utf-8');
    const exportSource = fs.readFileSync(exportPanelPath, 'utf-8');

    // 1. Verify TextProcessingSettingsPanel test IDs
    const expectedTpToggles = [
      'dictionaryEnabled',
      'whitespaceNormalization',
      'dateNormalization',
      'numberNormalization',
      'currencyNormalization',
      'abbreviationNormalization'
    ];

    expect(tpSource).toContain('data-testid={`tp-toggle-${item.key}`}');
    expect(tpSource).toContain('data-testid="tp-provider-select"');
    expect(tpSource).toContain('data-testid="tp-preview-btn"');
    expect(tpSource).toContain('data-testid="tp-save-processed-btn"');

    for (const toggleKey of expectedTpToggles) {
      expect(tpSource).toContain(`key: '${toggleKey}'`);
    }

    // Verify hint text span in TextProcessingSettingsPanel has break-words / whitespace-normal and no truncate class
    const tpHintSpanMatch = tpSource.match(/<span className="([^"]*)"[^>]*>\s*\{item\.hint\}/);
    expect(tpHintSpanMatch).not.toBeNull();
    const tpHintClasses = tpHintSpanMatch![1];
    expect(tpHintClasses).not.toContain('truncate');
    expect(tpHintClasses).toContain('break-words');
    expect(tpHintClasses).toContain('whitespace-normal');

    // 2. Verify ExportPanel test IDs
    const expectedExportToggles = [
      'export-opt-mp3',
      'export-opt-wav',
      'export-opt-individual-segments',
      'export-opt-srt',
      'export-opt-vtt',
      'export-opt-script-original',
      'export-opt-script-processed',
      'export-opt-markdown-manifest',
      'export-opt-project-json'
    ];

    for (const testId of expectedExportToggles) {
      expect(exportSource).toContain(`data-testid="${testId}"`);
    }

    expect(exportSource).toContain('data-testid="export-target-dir-input"');
    expect(exportSource).toContain('data-testid="export-select-dir-btn"');
    expect(exportSource).toContain('data-testid="export-submit-btn"');

    // Verify hint text elements in ExportPanel do not have truncate
    // In ExportPanel, hint text spans are formatted with text-[10px] text-slate-400
    const exportHintMatches = Array.from(exportSource.matchAll(/<div className="([^"]*)">([^<]+)<\/div>\s*<\/div>\s*<\/label>/g));
    expect(exportHintMatches.length).toBe(9);

    for (const match of exportHintMatches) {
      const hintClasses = match[1];
      expect(hintClasses).not.toContain('truncate');
      expect(hintClasses).toContain('break-words');
      expect(hintClasses).toContain('whitespace-normal');
    }
  });
});
