import fs from 'fs';
import path from 'path';
import type { Project } from '@shared/types/project.types';
import { logger } from '../logger/logger';

export const PROJECT_SUBDIRECTORIES = [
  'segments',
  'audio',
  'subtitles',
  'exports',
  'temp'
] as const;

export class ProjectFilesystemService {
  /**
   * Initializes the complete physical folder structure for a project.
   */
  public createProjectStructure(projectDir: string, project: Project): void {
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Create subdirectories
    for (const sub of PROJECT_SUBDIRECTORIES) {
      const subDir = path.join(projectDir, sub);
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
    }

    // Write initial metadata snapshot and script files
    this.writeProjectMetadataSnapshot(projectDir, project);
    this.writeScriptOriginal(projectDir, project.originalText);
    this.writeScriptProcessed(projectDir, project.processedText || '');

    logger.info('filesystem', `Initialized physical project files at: ${projectDir}`);
  }

  /**
   * Atomic-safe write for project.json snapshot (Section 13, 68).
   */
  public writeProjectMetadataSnapshot(projectDir: string, project: Project): void {
    const filePath = path.join(projectDir, 'project.json');
    const snapshot = {
      schemaVersion: 1,
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      providerId: project.providerId,
      voiceId: project.voiceId,
      settings: project.settings,
      revision: project.revision,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };

    this.atomicWriteFile(filePath, JSON.stringify(snapshot, null, 2));
  }

  /**
   * Writes the original script in UTF-8 (Section 14, 69).
   */
  public writeScriptOriginal(projectDir: string, text: string): void {
    const filePath = path.join(projectDir, 'script-original.txt');
    this.atomicWriteFile(filePath, text);
  }

  /**
   * Writes the processed script in UTF-8.
   */
  public writeScriptProcessed(projectDir: string, text: string): void {
    const filePath = path.join(projectDir, 'script-processed.txt');
    this.atomicWriteFile(filePath, text);
  }

  /**
   * Reconstructs missing physical files from SQLite source of truth (Sections 76, 77).
   */
  public selfHealProjectFiles(projectDir: string, project: Project): void {
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    for (const sub of PROJECT_SUBDIRECTORIES) {
      const subDir = path.join(projectDir, sub);
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
    }

    const metadataPath = path.join(projectDir, 'project.json');
    if (!fs.existsSync(metadataPath)) {
      logger.warn('filesystem', `Recreating missing project.json for project ${project.id}`);
      this.writeProjectMetadataSnapshot(projectDir, project);
    }

    const scriptPath = path.join(projectDir, 'script-original.txt');
    if (!fs.existsSync(scriptPath)) {
      logger.warn('filesystem', `Recreating missing script-original.txt for project ${project.id}`);
      this.writeScriptOriginal(projectDir, project.originalText);
    }

    const processedPath = path.join(projectDir, 'script-processed.txt');
    if (!fs.existsSync(processedPath)) {
      this.writeScriptProcessed(projectDir, project.processedText || '');
    }
  }

  /**
   * Performs an atomic write using temporary file rename.
   */
  public atomicWriteFile(targetPath: string, content: string): void {
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    try {
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, targetPath);
    } catch (error) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore temp cleanup error
        }
      }
      throw error;
    }
  }
}

export const projectFilesystemService = new ProjectFilesystemService();
