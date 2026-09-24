import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ffmpegBinaryService } from '../src/main/services/ffmpeg/ffmpegBinary.service';
import { ffprobeService } from '../src/main/services/ffmpeg/ffprobe.service';
import { ffmpegService } from '../src/main/services/ffmpeg/ffmpeg.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { spawn } from 'child_process';

describe('FFmpeg Audio Pipeline', () => {
  let tempDir: string;
  let seg1Path: string;
  let seg2Path: string;

  beforeAll(async () => {
    const testUserData = path.join(__dirname, '..', 'tmp_test_ffmpeg');
    appPathsService.initialize(testUserData);
    const paths = appPathsService.getPaths();
    tempDir = path.join(paths.projects, 'test_ffmpeg_project', 'audio', 'segments');
    await fs.promises.mkdir(tempDir, { recursive: true });

    seg1Path = path.join(tempDir, 'seg1.wav');
    seg2Path = path.join(tempDir, 'seg2.wav');

    const ffmpegPath = ffmpegBinaryService.resolveFFmpegPath() || 'ffmpeg';

    // Generate two 1-second sine wave test files
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ffmpegPath,
        ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', seg1Path],
        { shell: false }
      );
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    });

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ffmpegPath,
        ['-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=1', seg2Path],
        { shell: false }
      );
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    });
  });

  it('verifies FFmpeg and FFprobe binary availability', async () => {
    const info = await ffmpegBinaryService.testFFmpeg();
    expect(info.available).toBe(true);
    expect(info.version).toBeDefined();
    expect(info.ffmpegPath).toBeDefined();
  });

  it('probes audio file duration with integer millisecond precision', async () => {
    const probe = await ffprobeService.probeAudio(seg1Path);
    expect(probe.durationMs).toBe(1000);
    expect(probe.sampleRate).toBe(44100);
    expect(probe.channels).toBeGreaterThanOrEqual(1);
    expect(probe.sizeBytes).toBeGreaterThan(0);
  });

  it('merges audio segments with accurate sentence and paragraph pauses', async () => {
    const paths = appPathsService.getPaths();
    const outputPath = path.join(paths.projects, 'test_ffmpeg_project', 'audio', 'merged.wav');

    const result = await ffmpegService.mergeSegmentsAudio({
      segments: [
        { id: 'seg-1', audioPath: seg1Path, durationMs: 1000, paragraphIndex: 0 },
        { id: 'seg-2', audioPath: seg2Path, durationMs: 1000, paragraphIndex: 1 }
      ],
      sentencePauseMs: 200,
      paragraphPauseMs: 500, // paragraphIndex changed from 0 to 1 -> 500ms pause
      outputFilePath: outputPath,
      format: 'wav'
    });

    expect(fs.existsSync(result.filePath)).toBe(true);
    // 1000ms + 500ms pause + 1000ms = 2500ms
    expect(result.durationMs).toBe(2500);
    expect(result.segmentOffsets).toHaveLength(2);
    expect(result.segmentOffsets[0]).toEqual({
      segmentId: 'seg-1',
      startMs: 0,
      endMs: 1000,
      durationMs: 1000,
      pauseAfterMs: 500
    });
    expect(result.segmentOffsets[1]).toEqual({
      segmentId: 'seg-2',
      startMs: 1500,
      endMs: 2500,
      durationMs: 1000,
      pauseAfterMs: 0
    });
  });

  it('prevents writing audio outside the workspace', async () => {
    await expect(
      ffmpegService.mergeSegmentsAudio({
        segments: [{ id: 'seg-1', audioPath: seg1Path, durationMs: 1000, paragraphIndex: 0 }],
        outputFilePath: '/tmp/unauthorized_outside_workspace.wav',
        format: 'wav'
      })
    ).rejects.toThrow(/outside the authorized workspace/i);
  });
});
