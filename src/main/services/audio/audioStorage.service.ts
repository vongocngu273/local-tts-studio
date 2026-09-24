import fs from 'fs';
import path from 'path';
import { appPathsService } from '../app-paths/appPaths.service';
import { logger } from '../logger/logger';

export class AudioStorageService {
  /**
   * Returns the generations directory inside the project workspace:
   * <projects>/<projectId>/audio/generations
   */
  public getProjectAudioDir(projectId: string): string {
    const paths = appPathsService.getPaths();
    const dir = path.join(paths.projects, projectId, 'audio', 'generations');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Returns the preview cache directory:
   * <cache>/previews
   */
  public getPreviewCacheDir(): string {
    const paths = appPathsService.getPaths();
    const dir = path.join(paths.cache, 'previews');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Atomically saves project audio file to disk.
   */
  public async saveProjectAudio(
    projectId: string,
    generationId: string,
    audioBuffer: Buffer,
    format = 'mp3'
  ): Promise<{ filePath: string; sizeBytes: number }> {
    const targetDir = this.getProjectAudioDir(projectId);
    const fileName = `${generationId}.${format}`;
    const filePath = path.join(targetDir, fileName);
    const tempPath = path.join(targetDir, `${fileName}.${Date.now()}.tmp`);

    await fs.promises.writeFile(tempPath, audioBuffer);
    await fs.promises.rename(tempPath, filePath);

    const sizeBytes = audioBuffer.byteLength;
    logger.info('audio:storage', `Saved project audio: ${filePath} (${sizeBytes} bytes)`);

    return { filePath, sizeBytes };
  }

  /**
   * Saves preview audio into LRU cache folder.
   */
  public async savePreviewAudio(
    cacheKeyHash: string,
    audioBuffer: Buffer,
    format = 'mp3'
  ): Promise<{ filePath: string; sizeBytes: number }> {
    const cacheDir = this.getPreviewCacheDir();
    const fileName = `${cacheKeyHash}.${format}`;
    const filePath = path.join(cacheDir, fileName);
    const tempPath = path.join(cacheDir, `${fileName}.${Date.now()}.tmp`);

    await fs.promises.writeFile(tempPath, audioBuffer);
    await fs.promises.rename(tempPath, filePath);

    const sizeBytes = audioBuffer.byteLength;
    logger.info('audio:storage', `Saved voice preview cache: ${filePath} (${sizeBytes} bytes)`);

    return { filePath, sizeBytes };
  }

  /**
   * Checks if cached preview audio exists.
   */
  public getPreviewAudioPath(cacheKeyHash: string, format = 'mp3'): string | null {
    const cacheDir = this.getPreviewCacheDir();
    const filePath = path.join(cacheDir, `${cacheKeyHash}.${format}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * Saves companion timing JSON file (word/char offsets).
   */
  public async saveTimingFile(audioFilePath: string, timings: unknown): Promise<string> {
    const ext = path.extname(audioFilePath);
    const base = audioFilePath.slice(0, -ext.length);
    const timingPath = `${base}.timing.json`;
    await fs.promises.writeFile(timingPath, JSON.stringify(timings, null, 2), 'utf-8');
    return timingPath;
  }

  /**
   * Saves companion SRT subtitle file.
   */
  public async saveSubtitleFile(audioFilePath: string, srtContent: string): Promise<string> {
    const ext = path.extname(audioFilePath);
    const base = audioFilePath.slice(0, -ext.length);
    const srtPath = `${base}.srt`;
    await fs.promises.writeFile(srtPath, srtContent, 'utf-8');
    return srtPath;
  }

  /**
   * Enforces preview cache maintenance (deletes files older than maxAgeDays or exceeds maxFiles).
   */
  public async cleanPreviewCache(maxAgeDays = 7, maxFiles = 200): Promise<number> {
    try {
      const cacheDir = this.getPreviewCacheDir();
      const files = await fs.promises.readdir(cacheDir);
      if (files.length === 0) return 0;

      const now = Date.now();
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      const fileStats: { name: string; fullPath: string; mtime: number }[] = [];

      for (const file of files) {
        const fullPath = path.join(cacheDir, file);
        try {
          const stat = await fs.promises.stat(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.promises.unlink(fullPath);
            deletedCount++;
          } else {
            fileStats.push({ name: file, fullPath, mtime: stat.mtimeMs });
          }
        } catch {
          // ignore stat errors
        }
      }

      // If count exceeds maxFiles, remove oldest
      if (fileStats.length > maxFiles) {
        fileStats.sort((a, b) => a.mtime - b.mtime);
        const toRemove = fileStats.slice(0, fileStats.length - maxFiles);
        for (const item of toRemove) {
          try {
            await fs.promises.unlink(item.fullPath);
            deletedCount++;
          } catch {
            // ignore
          }
        }
      }

      if (deletedCount > 0) {
        logger.info('audio:storage', `Cleaned ${deletedCount} expired preview audio file(s)`);
      }
      return deletedCount;
    } catch (err) {
      logger.error('audio:storage', 'Error during preview cache cleanup', err);
      return 0;
    }
  }

  /**
   * Returns the segments directory for a specific segment inside the project workspace:
   * <projects>/<projectId>/audio/segments/<segmentId>
   */
  public getSegmentAudioDir(projectId: string, segmentId: string): string {
    const paths = appPathsService.getPaths();
    const dir = path.join(paths.projects, projectId, 'audio', 'segments', segmentId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Returns the compositions directory inside the project workspace:
   * <projects>/<projectId>/audio/compositions
   */
  public getCompositionsDir(projectId: string): string {
    const paths = appPathsService.getPaths();
    const dir = path.join(paths.projects, projectId, 'audio', 'compositions');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Returns the subtitles directory inside the project workspace:
   * <projects>/<projectId>/subtitles
   */
  public getSubtitlesDir(projectId: string): string {
    const paths = appPathsService.getPaths();
    const dir = path.join(paths.projects, projectId, 'subtitles');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Atomically saves segment audio and metadata.
   * Updates current.mp3 and timing.json non-destructively.
   */
  public async saveSegmentAudio(
    projectId: string,
    segmentId: string,
    generationId: string,
    audioBuffer: Buffer,
    format = 'mp3',
    metadata?: Record<string, unknown>,
    timings?: unknown
  ): Promise<{ filePath: string; timingPath?: string; sizeBytes: number }> {
    const segmentDir = this.getSegmentAudioDir(projectId, segmentId);
    const genDir = path.join(segmentDir, 'generations', generationId);
    if (!fs.existsSync(genDir)) {
      await fs.promises.mkdir(genDir, { recursive: true });
    }

    // 1. Save generation audio
    const genAudioPath = path.join(genDir, `audio.${format}`);
    const tempGenAudio = path.join(genDir, `audio.${format}.${Date.now()}.tmp`);
    await fs.promises.writeFile(tempGenAudio, audioBuffer);
    await fs.promises.rename(tempGenAudio, genAudioPath);

    // 2. Save generation metadata
    if (metadata) {
      const metaPath = path.join(genDir, 'metadata.json');
      await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    // 3. Atomically update current audio
    const currentAudioPath = path.join(segmentDir, `current.${format}`);
    const tempCurrentAudio = path.join(segmentDir, `current.${format}.${Date.now()}.tmp`);
    await fs.promises.writeFile(tempCurrentAudio, audioBuffer);
    await fs.promises.rename(tempCurrentAudio, currentAudioPath);

    // 4. Save timing if present
    let timingPath: string | undefined;
    if (timings !== undefined && timings !== null) {
      const genTimingPath = path.join(genDir, 'timing.json');
      const currentTimingPath = path.join(segmentDir, 'timing.json');
      const timingJson = JSON.stringify(timings, null, 2);
      await fs.promises.writeFile(genTimingPath, timingJson, 'utf-8');

      const tempCurrentTiming = path.join(segmentDir, `timing.json.${Date.now()}.tmp`);
      await fs.promises.writeFile(tempCurrentTiming, timingJson, 'utf-8');
      await fs.promises.rename(tempCurrentTiming, currentTimingPath);
      timingPath = currentTimingPath;
    }

    const sizeBytes = audioBuffer.byteLength;
    logger.info('audio:storage', `Saved segment audio: ${currentAudioPath} (${sizeBytes} bytes)`);

    return { filePath: currentAudioPath, timingPath, sizeBytes };
  }

  /**
   * Retrieves path to current segment audio if exists.
   */
  public getSegmentAudioPath(projectId: string, segmentId: string, format = 'mp3'): string | null {
    const paths = appPathsService.getPaths();
    const filePath = path.join(paths.projects, projectId, 'audio', 'segments', segmentId, `current.${format}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * Retrieves path to current segment timing JSON if exists.
   */
  public getSegmentTimingPath(projectId: string, segmentId: string): string | null {
    const paths = appPathsService.getPaths();
    const filePath = path.join(paths.projects, projectId, 'audio', 'segments', segmentId, 'timing.json');
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  /**
   * Verifies that target audio file is strictly inside the application workspace.
   */
  public isPathWithinWorkspace(targetPath: string): boolean {
    const paths = appPathsService.getPaths();
    const resolved = path.resolve(targetPath);
    return resolved.startsWith(paths.projects) || resolved.startsWith(paths.cache) || resolved.startsWith(paths.root);
  }
}

export const audioStorageService = new AudioStorageService();
