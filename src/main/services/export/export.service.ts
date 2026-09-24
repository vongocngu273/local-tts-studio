import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { ProjectExportOptions, ProjectExportResult } from '@shared/types/export.types';
import { DEFAULT_EXPORT_OPTIONS } from '@shared/types/export.types';
import { projectRepository } from '../../database/repositories/project.repository';
import { segmentRepository } from '../../database/repositories/segment.repository';
import { audioCompositionService } from '../composition/audioComposition.service';
import { subtitleService } from '../subtitles/subtitle.service';
import { ffmpegBinaryService } from '../ffmpeg/ffmpegBinary.service';
import { logger } from '../logger/logger';

export class ExportService {
  /**
   * Exports an entire project bundle into the specified directory.
   */
  public async exportProjectBundle(
    projectId: string,
    targetDirectory: string,
    options?: Partial<ProjectExportOptions>
  ): Promise<ProjectExportResult> {
    const project = projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found.`);
    }

    const opts: ProjectExportOptions = {
      ...DEFAULT_EXPORT_OPTIONS,
      ...options
    };

    if (!fs.existsSync(targetDirectory)) {
      await fs.promises.mkdir(targetDirectory, { recursive: true });
    }

    const exportedFiles: string[] = [];
    let totalSizeBytes = 0;

    // 1. Ensure Audio Composition
    let composition = audioCompositionService.getLatestComposition(projectId);
    if (
      (opts.includeMp3 || opts.includeWav) &&
      (!composition || !composition.outputMp3Path || !fs.existsSync(composition.outputMp3Path))
    ) {
      try {
        const compResult = await audioCompositionService.composeProjectAudio(projectId);
        composition = compResult.composition;
      } catch (err) {
        logger.warn('export:bundle', 'Could not compose audio for project (segments may not be ready)', err);
      }
    }

    // 2. Export MP3
    if (opts.includeMp3 && composition?.outputMp3Path && fs.existsSync(composition.outputMp3Path)) {
      const mp3Dest = path.join(targetDirectory, 'audio.mp3');
      await fs.promises.copyFile(composition.outputMp3Path, mp3Dest);
      const stat = await fs.promises.stat(mp3Dest);
      exportedFiles.push(mp3Dest);
      totalSizeBytes += stat.size;
    }

    // 3. Export WAV
    if (opts.includeWav && composition?.outputMp3Path && fs.existsSync(composition.outputMp3Path)) {
      const wavDest = path.join(targetDirectory, 'audio.wav');
      const ffmpegPath = ffmpegBinaryService.resolveFFmpegPath() || 'ffmpeg';

      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          ffmpegPath,
          ['-y', '-i', composition.outputMp3Path!, '-c:a', 'pcm_s16le', '-f', 'wav', wavDest],
          { shell: false, windowsHide: true }
        );
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg WAV conversion exited with code ${code}`));
        });
        child.on('error', reject);
      });

      const stat = await fs.promises.stat(wavDest);
      exportedFiles.push(wavDest);
      totalSizeBytes += stat.size;
    }

    // 4. Export SRT
    if (opts.includeSrt) {
      try {
        const srtRes = await subtitleService.exportSubtitles(projectId, 'srt');
        const srtDest = path.join(targetDirectory, 'subtitle.srt');
        await fs.promises.copyFile(srtRes.filePath, srtDest);
        const stat = await fs.promises.stat(srtDest);
        exportedFiles.push(srtDest);
        totalSizeBytes += stat.size;
      } catch (err) {
        logger.warn('export:bundle', 'Could not export SRT subtitle', err);
      }
    }

    // 5. Export VTT
    if (opts.includeVtt) {
      try {
        const vttRes = await subtitleService.exportSubtitles(projectId, 'vtt');
        const vttDest = path.join(targetDirectory, 'subtitle.vtt');
        await fs.promises.copyFile(vttRes.filePath, vttDest);
        const stat = await fs.promises.stat(vttDest);
        exportedFiles.push(vttDest);
        totalSizeBytes += stat.size;
      } catch (err) {
        logger.warn('export:bundle', 'Could not export VTT subtitle', err);
      }
    }

    // 6. Export Original Script
    if (opts.includeScriptOriginal && project.originalText) {
      const origDest = path.join(targetDirectory, 'script-original.txt');
      await fs.promises.writeFile(origDest, project.originalText, 'utf-8');
      const stat = await fs.promises.stat(origDest);
      exportedFiles.push(origDest);
      totalSizeBytes += stat.size;
    }

    // 7. Export Processed Script
    if (opts.includeScriptProcessed && project.processedText) {
      const procDest = path.join(targetDirectory, 'script-processed.txt');
      await fs.promises.writeFile(procDest, project.processedText, 'utf-8');
      const stat = await fs.promises.stat(procDest);
      exportedFiles.push(procDest);
      totalSizeBytes += stat.size;
    }

    // 8. Export Project JSON
    if (opts.includeProjectJson) {
      const jsonDest = path.join(targetDirectory, 'project.json');
      const segments = segmentRepository.listByProject(projectId);
      const projectData = {
        project: {
          id: project.id,
          name: project.name,
          providerId: project.providerId,
          voiceId: project.voiceId,
          settings: project.settings,
          revision: project.revision,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        },
        composition: {
          durationMs: composition?.durationMs ?? 0,
          segmentCount: composition?.segmentCount ?? segments.length
        },
        segments: segments.map((s) => ({
          segmentIndex: s.segmentIndex,
          text: s.text,
          durationMs: s.durationMs,
          pauseAfterMs: s.pauseAfterMs,
          status: s.status
        }))
      };

      await fs.promises.writeFile(jsonDest, JSON.stringify(projectData, null, 2), 'utf-8');
      const stat = await fs.promises.stat(jsonDest);
      exportedFiles.push(jsonDest);
      totalSizeBytes += stat.size;
    }

    // 9. Export Individual Segments
    if (opts.includeIndividualSegments) {
      const segments = segmentRepository.listByProject(projectId);
      const validAudioSegments = segments.filter(
        (s) => s.audioPath && fs.existsSync(s.audioPath)
      );

      if (validAudioSegments.length > 0) {
        const segDir = path.join(targetDirectory, 'segments');
        if (!fs.existsSync(segDir)) {
          await fs.promises.mkdir(segDir, { recursive: true });
        }

        for (const s of validAudioSegments) {
          const destFile = path.join(
            segDir,
            `${String(s.segmentIndex + 1).padStart(3, '0')}_segment.mp3`
          );
          await fs.promises.copyFile(s.audioPath!, destFile);
          const stat = await fs.promises.stat(destFile);
          exportedFiles.push(destFile);
          totalSizeBytes += stat.size;
        }
      }
    }

    // 10. Export Markdown Manifest
    if (opts.includeMarkdownManifest) {
      const manifestDest = path.join(targetDirectory, 'manifest.md');
      const segments = segmentRepository.listByProject(projectId);

      const totalSeconds = Math.floor((composition?.durationMs || 0) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const formattedDuration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      const exportTimestamp = new Date().toISOString();

      const lines: string[] = [
        `# Project Export Manifest: ${project.name}`,
        '',
        '## Metadata',
        '',
        '| Property | Value |',
        '| --- | --- |',
        `| Project ID | ${project.id} |`,
        `| Status | ${project.status} |`,
        `| Provider | ${project.providerId} |`,
        `| Voice | ${project.voiceId} |`,
        `| Total Segments | ${composition?.segmentCount ?? segments.length} |`,
        `| Composition Duration | ${formattedDuration} |`,
        `| Export Timestamp | ${exportTimestamp} |`,
        '',
        '## Segment Timeline',
        '',
        '| Index | Text snippet | Duration (ms) | Pause (ms) | Status |',
        '| --- | --- | --- | --- | --- |'
      ];

      for (const s of segments) {
        const snippet = (s.text || '')
          .replace(/\r?\n/g, ' ')
          .slice(0, 60)
          .replace(/\|/g, '\\|');
        lines.push(
          `| ${s.segmentIndex + 1} | ${snippet} | ${s.durationMs ?? 0} | ${s.pauseAfterMs ?? 0} | ${s.status} |`
        );
      }

      lines.push('');
      const manifestContent = lines.join('\n');

      await fs.promises.writeFile(manifestDest, manifestContent, 'utf-8');
      const stat = await fs.promises.stat(manifestDest);
      exportedFiles.push(manifestDest);
      totalSizeBytes += stat.size;
    }

    logger.info(
      'export:bundle',
      `Exported project ${projectId} bundle (${exportedFiles.length} files, ${totalSizeBytes} bytes) to ${targetDirectory}`
    );

    return {
      targetDirectory,
      exportedFiles,
      totalSizeBytes
    };
  }
}

export const exportService = new ExportService();
