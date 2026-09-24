import fs from 'fs';
import { spawn } from 'child_process';
import { logger } from '../logger/logger';

export interface FFmpegInfo {
  available: boolean;
  version?: string;
  ffmpegPath?: string;
  ffprobePath?: string;
  error?: string;
}

export class FFmpegBinaryService {
  private cachedInfo: FFmpegInfo | null = null;

  /**
   * Resolves FFmpeg binary path following 3-tier priority:
   * 1. Environment variables / Settings override (FFMPEG_PATH)
   * 2. Common system locations (/opt/homebrew/bin, /usr/local/bin, /usr/bin)
   * 3. PATH resolution
   */
  public resolveFFmpegPath(): string | null {
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      return process.env.FFMPEG_PATH;
    }

    const standardPaths = [
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg',
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe'
    ];

    for (const p of standardPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return 'ffmpeg';
  }

  /**
   * Resolves FFprobe binary path following 3-tier priority:
   * 1. Environment variables / Settings override (FFPROBE_PATH)
   * 2. Common system locations
   * 3. PATH resolution
   */
  public resolveFFprobePath(): string | null {
    if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
      return process.env.FFPROBE_PATH;
    }

    const standardPaths = [
      '/opt/homebrew/bin/ffprobe',
      '/usr/local/bin/ffprobe',
      '/usr/bin/ffprobe',
      'C:\\ffmpeg\\bin\\ffprobe.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe'
    ];

    for (const p of standardPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return 'ffprobe';
  }

  /**
   * Executes self-test on FFmpeg and FFprobe binaries.
   */
  public async testFFmpeg(): Promise<FFmpegInfo> {
    const ffmpegPath = this.resolveFFmpegPath();
    const ffprobePath = this.resolveFFprobePath();

    if (!ffmpegPath) {
      return {
        available: false,
        error: 'FFmpeg binary not found on this system.'
      };
    }

    try {
      const versionOutput = await this.executeBinary(ffmpegPath, ['-version']);
      const firstLine = versionOutput.split('\n')[0] || '';
      const versionMatch = firstLine.match(/ffmpeg\s+version\s+([^\s]+)/i);
      const version = versionMatch ? versionMatch[1] : firstLine.trim();

      // Also verify ffprobe
      let probeAvailable = false;
      if (ffprobePath) {
        try {
          await this.executeBinary(ffprobePath, ['-version']);
          probeAvailable = true;
        } catch {
          probeAvailable = false;
        }
      }

      const info: FFmpegInfo = {
        available: true,
        version,
        ffmpegPath,
        ffprobePath: probeAvailable && ffprobePath ? ffprobePath : undefined
      };
      this.cachedInfo = info;

      logger.info('ffmpeg:binary', `FFmpeg verified: ${version} at ${ffmpegPath}`);
      return info;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const info: FFmpegInfo = {
        available: false,
        ffmpegPath,
        error: `Failed to execute FFmpeg: ${msg}`
      };
      this.cachedInfo = info;
      logger.warn('ffmpeg:binary', `FFmpeg check failed: ${msg}`);
      return info;
    }
  }

  public getCachedInfo(): FFmpegInfo | null {
    return this.cachedInfo;
  }

  private executeBinary(binaryPath: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath, args, {
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
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout || stderr);
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });
    });
  }
}

export const ffmpegBinaryService = new FFmpegBinaryService();
