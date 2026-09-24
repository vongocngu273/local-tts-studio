import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { AudioStorageService } from '../src/main/services/audio/audioStorage.service';

describe('AudioStorageService & File Management', () => {
  let tempBaseDir: string;
  let audioService: AudioStorageService;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-audio-test-'));
    appPathsService.initialize(tempBaseDir);
    audioService = new AudioStorageService();
  });

  afterEach(() => {
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should atomically save project audio file and report accurate size', async () => {
    const projectId = 'proj-test-123';
    const genId = 'gen-test-456';
    const dummyAudio = Buffer.from('RIFF....WAVEfmt ....data....');

    const result = await audioService.saveProjectAudio(projectId, genId, dummyAudio, 'mp3');

    expect(result.sizeBytes).toBe(dummyAudio.byteLength);
    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(result.filePath).toContain(path.join('projects', projectId, 'audio', 'generations'));
    expect(result.filePath.endsWith('.mp3')).toBe(true);

    const savedContent = fs.readFileSync(result.filePath);
    expect(savedContent.equals(dummyAudio)).toBe(true);
  });

  it('should save and retrieve preview audio from LRU cache', async () => {
    const cacheHash = 'preview_hash_abc123';
    const dummyAudio = Buffer.from('PREVIEW_AUDIO_BUFFER_DATA');

    expect(audioService.getPreviewAudioPath(cacheHash)).toBeNull();

    const saved = await audioService.savePreviewAudio(cacheHash, dummyAudio);
    expect(saved.sizeBytes).toBe(dummyAudio.byteLength);

    const retrievedPath = audioService.getPreviewAudioPath(cacheHash);
    expect(retrievedPath).not.toBeNull();
    expect(retrievedPath).toBe(saved.filePath);
    expect(fs.existsSync(retrievedPath!)).toBe(true);
  });

  it('should save companion timing JSON and subtitle files correctly', async () => {
    const projectId = 'proj-timing-test';
    const genId = 'gen-timing-789';
    const dummyAudio = Buffer.from('AUDIO_WITH_TIMINGS');

    const { filePath } = await audioService.saveProjectAudio(projectId, genId, dummyAudio, 'mp3');

    const mockTimings = [
      { text: 'Xin', offset: 0, duration: 250 },
      { text: 'chào', offset: 250, duration: 300 }
    ];
    const timingPath = await audioService.saveTimingFile(filePath, mockTimings);
    expect(fs.existsSync(timingPath)).toBe(true);
    expect(timingPath.endsWith('.timing.json')).toBe(true);

    const readTimings = JSON.parse(fs.readFileSync(timingPath, 'utf-8'));
    expect(readTimings).toEqual(mockTimings);

    const srtContent = '1\n00:00:00,000 --> 00:00:00,550\nXin chào';
    const srtPath = await audioService.saveSubtitleFile(filePath, srtContent);
    expect(fs.existsSync(srtPath)).toBe(true);
    expect(srtPath.endsWith('.srt')).toBe(true);
    expect(fs.readFileSync(srtPath, 'utf-8')).toBe(srtContent);
  });

  it('should clean expired or excess files in preview cache', async () => {
    const cacheDir = audioService.getPreviewCacheDir();

    // Write 5 files
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(cacheDir, `file_${i}.mp3`), `content_${i}`);
    }
    expect(fs.readdirSync(cacheDir).length).toBe(5);

    // Keep max 2 files
    const cleaned = await audioService.cleanPreviewCache(30, 2);
    expect(cleaned).toBe(3);
    expect(fs.readdirSync(cacheDir).length).toBe(2);
  });

  it('should strictly confine audio file paths within workspace directory', () => {
    const paths = appPathsService.getPaths();
    const validProjectPath = path.join(paths.projects, 'proj-1', 'audio', 'generations', 'gen-1.mp3');
    const validCachePath = path.join(paths.cache, 'previews', 'hash-1.mp3');
    const maliciousPath1 = '/etc/passwd';
    const maliciousPath2 = path.join(paths.root, '..', '..', 'other-dir', 'secret.mp3');

    expect(audioService.isPathWithinWorkspace(validProjectPath)).toBe(true);
    expect(audioService.isPathWithinWorkspace(validCachePath)).toBe(true);
    expect(audioService.isPathWithinWorkspace(maliciousPath1)).toBe(false);
    expect(audioService.isPathWithinWorkspace(maliciousPath2)).toBe(false);
  });
});
