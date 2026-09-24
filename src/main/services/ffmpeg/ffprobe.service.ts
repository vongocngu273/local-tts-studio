import { spawn } from 'child_process';
import { ffmpegBinaryService } from './ffmpegBinary.service';
import { logger } from '../logger/logger';

export interface AudioProbeResult {
  durationMs: number;
  sampleRate: number;
  channels: number;
  format: string;
  bitRate: number;
  sizeBytes: number;
}

export class FFprobeService {
  /**
   * Probes an audio file and returns accurate timing and audio metadata.
   * Duration is strictly in integer milliseconds.
   */
  public async probeAudio(filePath: string): Promise<AudioProbeResult> {
    const ffprobePath = ffmpegBinaryService.resolveFFprobePath();
    if (!ffprobePath) {
      throw new Error('FFprobe binary not available');
    }

    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const jsonStr = await this.executeProbe(ffprobePath, args);
    const data = JSON.parse(jsonStr);

    const format = data.format || {};
    const audioStream = (data.streams || []).find(
      (s: { codec_type?: string }) => s.codec_type === 'audio'
    ) || {};

    const rawDuration = parseFloat(format.duration || audioStream.duration || '0');
    const durationMs = Math.round(rawDuration * 1000);

    const sampleRate = parseInt(audioStream.sample_rate || '44100', 10);
    const channels = parseInt(audioStream.channels || '2', 10);
    const bitRate = parseInt(format.bit_rate || audioStream.bit_rate || '0', 10);
    const sizeBytes = parseInt(format.size || '0', 10);

    return {
      durationMs,
      sampleRate,
      channels,
      format: format.format_name || 'mp3',
      bitRate,
      sizeBytes
    };
  }

  private executeProbe(ffprobePath: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(ffprobePath, args, {
        shell: false,
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        logger.error('ffprobe', 'FFprobe spawn error', err);
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        }
      });
    });
  }
}

export const ffprobeService = new FFprobeService();
