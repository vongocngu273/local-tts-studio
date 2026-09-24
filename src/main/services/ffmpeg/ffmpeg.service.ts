import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ffmpegBinaryService } from './ffmpegBinary.service';
import { ffprobeService } from './ffprobe.service';
import { audioStorageService } from '../audio/audioStorage.service';
import { logger } from '../logger/logger';
import type { SegmentAudioOffset } from '@shared/types/composition.types';
export type { SegmentAudioOffset };

export interface SegmentMergeInput {
  id: string;
  audioPath: string;
  durationMs: number;
  paragraphIndex: number;
}


export interface MergeSegmentsOptions {
  segments: SegmentMergeInput[];
  sentencePauseMs?: number;
  paragraphPauseMs?: number;
  outputFilePath: string;
  format?: 'mp3' | 'wav';
  sampleRate?: number;
  bitrate?: string;
  channels?: number;
  onProgress?: (percent: number) => void;
}

export interface MergeSegmentsResult {
  filePath: string;
  durationMs: number;
  sizeBytes: number;
  segmentOffsets: SegmentAudioOffset[];
}

export class FFmpegService {
  private activeProcesses = new Map<string, ChildProcess>();

  /**
   * Concatenates an ordered list of segment audio files with configurable sentence and paragraph pauses.
   * Direct child_process.spawn execution (no shell).
   * Generates exact integer millisecond offsets for waveform regions and subtitle cues.
   */
  public async mergeSegmentsAudio(options: MergeSegmentsOptions): Promise<MergeSegmentsResult> {
    const {
      segments,
      sentencePauseMs = 250,
      paragraphPauseMs = 600,
      outputFilePath,
      format = 'mp3',
      sampleRate = 44100,
      bitrate = '192k',
      channels = 2,
      onProgress
    } = options;

    if (segments.length === 0) {
      throw new Error('Cannot merge empty segment list.');
    }

    if (!audioStorageService.isPathWithinWorkspace(outputFilePath)) {
      throw new Error(`Output path "${outputFilePath}" is outside the authorized workspace.`);
    }

    // Verify all input segment audio files exist
    for (const seg of segments) {
      if (!fs.existsSync(seg.audioPath)) {
        throw new Error(`Audio file for segment ${seg.id} not found: ${seg.audioPath}`);
      }
    }

    const ffmpegPath = ffmpegBinaryService.resolveFFmpegPath();
    if (!ffmpegPath) {
      throw new Error('FFmpeg binary is not available.');
    }

    // Ensure output parent directory exists
    const outputDir = path.dirname(outputFilePath);
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }

    // Calculate exact millisecond timing offsets
    const segmentOffsets: SegmentAudioOffset[] = [];
    let currentMs = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const startMs = currentMs;
      const endMs = startMs + seg.durationMs;

      let pauseAfterMs = 0;
      if (i < segments.length - 1) {
        const nextSeg = segments[i + 1];
        pauseAfterMs =
          nextSeg.paragraphIndex > seg.paragraphIndex ? paragraphPauseMs : sentencePauseMs;
      }

      segmentOffsets.push({
        segmentId: seg.id,
        startMs,
        endMs,
        durationMs: seg.durationMs,
        pauseAfterMs
      });

      currentMs = endMs + pauseAfterMs;
    }

    const totalExpectedDurationMs = currentMs;
    const tempOutputPath = `${outputFilePath}.${Date.now()}.tmp`;

    // Build FFmpeg command arguments
    const args: string[] = ['-y'];

    // 1. Inputs
    for (const seg of segments) {
      args.push('-i', seg.audioPath);
    }

    // 2. Filter complex
    // If single segment without pause:
    if (segments.length === 1) {
      args.push(
        '-ar',
        sampleRate.toString(),
        '-ac',
        channels.toString()
      );
      if (format === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', bitrate, '-f', 'mp3');
      } else {
        args.push('-c:a', 'pcm_s16le', '-f', 'wav');
      }
      args.push(tempOutputPath);
    } else {
      // Build filter graph
      const filterParts: string[] = [];
      const concatInputs: string[] = [];

      for (let i = 0; i < segments.length; i++) {
        // Standardize format of each input
        filterParts.push(
          `[${i}:a]aformat=sample_fmts=s16:sample_rates=${sampleRate}:channel_layouts=stereo[a${i}]`
        );
        concatInputs.push(`[a${i}]`);

        // Insert silence between segments if pause > 0
        if (i < segments.length - 1) {
          const pauseMs = segmentOffsets[i].pauseAfterMs;
          if (pauseMs > 0) {
            const pauseSeconds = (pauseMs / 1000).toFixed(4);
            filterParts.push(
              `anullsrc=r=${sampleRate}:cl=stereo,atrim=end=${pauseSeconds},asetpts=PTS-STARTPTS[p${i}]`
            );
            concatInputs.push(`[p${i}]`);
          }
        }
      }

      const totalConcatItems = concatInputs.length;
      filterParts.push(
        `${concatInputs.join('')}concat=n=${totalConcatItems}:v=0:a=1[out]`
      );

      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[out]');
      args.push('-ar', sampleRate.toString());
      args.push('-ac', channels.toString());

      if (format === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', bitrate, '-f', 'mp3');
      } else {
        args.push('-c:a', 'pcm_s16le', '-f', 'wav');
      }

      args.push(tempOutputPath);
    }

    const mergeProcessId = `merge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      await this.runFFmpegProcess(ffmpegPath, args, mergeProcessId, totalExpectedDurationMs, onProgress);

      // Atomic rename temp output to final output file
      if (fs.existsSync(outputFilePath)) {
        await fs.promises.unlink(outputFilePath);
      }
      await fs.promises.rename(tempOutputPath, outputFilePath);

      // Probe final output for verified duration and size
      let verifiedDurationMs = totalExpectedDurationMs;
      let sizeBytes = 0;

      try {
        const probe = await ffprobeService.probeAudio(outputFilePath);
        verifiedDurationMs = probe.durationMs > 0 ? probe.durationMs : totalExpectedDurationMs;
        sizeBytes = probe.sizeBytes;
      } catch (probeErr) {
        logger.warn('ffmpeg:merge', 'Probe failed, falling back to expected duration/stat', probeErr);
        const stat = await fs.promises.stat(outputFilePath);
        sizeBytes = stat.size;
      }

      logger.info(
        'ffmpeg:merge',
        `Successfully merged ${segments.length} segment(s) -> ${outputFilePath} (${verifiedDurationMs}ms, ${sizeBytes} bytes)`
      );

      return {
        filePath: outputFilePath,
        durationMs: verifiedDurationMs,
        sizeBytes,
        segmentOffsets
      };
    } catch (err) {
      if (fs.existsSync(tempOutputPath)) {
        try {
          await fs.promises.unlink(tempOutputPath);
        } catch {
          // ignore
        }
      }
      throw err;
    } finally {
      this.activeProcesses.delete(mergeProcessId);
    }
  }

  /**
   * Cancels a running merge process.
   */
  public cancelMerge(processId?: string): void {
    if (processId && this.activeProcesses.has(processId)) {
      const child = this.activeProcesses.get(processId);
      child?.kill('SIGTERM');
      this.activeProcesses.delete(processId);
    } else {
      for (const [id, child] of this.activeProcesses.entries()) {
        child.kill('SIGTERM');
        this.activeProcesses.delete(id);
      }
    }
  }

  private runFFmpegProcess(
    ffmpegPath: string,
    args: string[],
    processId: string,
    totalExpectedDurationMs: number,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(ffmpegPath, args, {
        shell: false,
        windowsHide: true
      });

      this.activeProcesses.set(processId, child);

      let stderr = '';

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;

        if (onProgress && totalExpectedDurationMs > 0) {
          // Parse time=HH:MM:SS.ms
          const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
          if (timeMatch) {
            const hours = parseFloat(timeMatch[1]);
            const minutes = parseFloat(timeMatch[2]);
            const seconds = parseFloat(timeMatch[3]);
            const currentMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
            const percent = Math.min(100, Math.round((currentMs / totalExpectedDurationMs) * 100));
            onProgress(percent);
          }
        }
      });

      child.on('error', (err) => {
        logger.error('ffmpeg:exec', `FFmpeg process error: ${err.message}`);
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          if (onProgress) onProgress(100);
          resolve();
        } else {
          logger.error('ffmpeg:exec', `FFmpeg exited with code ${code}. Stderr: ${stderr.slice(-1000)}`);
          reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        }
      });
    });
  }
}

export const ffmpegService = new FFmpegService();
