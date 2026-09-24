import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { shell } from 'electron';
import { projectRepository } from '../../database/repositories/project.repository';
import { projectDraftRepository } from '../../database/repositories/projectDraft.repository';
import { projectFilesystemService } from '../project-filesystem/projectFilesystem.service';
import { appPathsService } from '../app-paths/appPaths.service';
import { logger } from '../logger/logger';
import type {
  Project,
  ProjectDraft,
  CreateProjectInput,
  UpdateProjectInput,
  SaveProjectTextInput,
  SaveProjectDraftInput,
  ProjectListOptionsInput
} from '@shared/types/project.types';

export class ProjectService {
  /**
   * Creates a new project with auto-incrementing default name, UUID, and directory hierarchy.
   */
  public createProject(input?: CreateProjectInput): Project {
    const id = uuidv4();
    const projectsRoot = appPathsService.getPaths().projects;
    const projectPath = path.join(projectsRoot, id);

    const name = input?.name?.trim() ? input.name.trim() : this.generateUniqueProjectName();
    const now = new Date().toISOString();

    const newProject: Project = {
      id,
      name,
      description: input?.description?.trim() || null,
      status: 'draft',
      originalText: '',
      processedText: '',
      providerId: null,
      voiceId: null,
      settings: {
        version: 1,
        text: { normalizationEnabled: true },
        voice: { speed: 1.0, pitch: 0, volume: 100 }
      },
      projectPath,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      deletedAt: null
    };

    try {
      // 1. Create physical folders and files
      projectFilesystemService.createProjectStructure(projectPath, newProject);

      // 2. Insert record into database
      projectRepository.insert(newProject);

      logger.info('project', `Created project "${name}" with ID: ${id}`);
      return newProject;
    } catch (error) {
      logger.error('project', `Failed to create project ${id}`, error);
      // Clean up physical directory if creation failed
      if (fs.existsSync(projectPath)) {
        try {
          fs.rmSync(projectPath, { recursive: true, force: true });
        } catch {
          // ignore cleanup error
        }
      }
      throw error;
    }
  }

  public getProject(id: string): Project | null {
    const project = projectRepository.findById(id);
    if (!project) return null;

    // Self-heal filesystem files if missing
    projectFilesystemService.selfHealProjectFiles(project.projectPath, project);

    // Touch last_opened_at
    projectRepository.touch(id);
    return project;
  }

  public listProjects(options?: ProjectListOptionsInput): Project[] {
    return projectRepository.findAll(options);
  }

  public countProjects(): number {
    return projectRepository.count(false);
  }

  public updateProject(id: string, changes: UpdateProjectInput): Project {
    const existing = projectRepository.findById(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    projectRepository.update(id, changes);
    const updated = projectRepository.findById(id)!;

    projectFilesystemService.writeProjectMetadataSnapshot(updated.projectPath, updated);
    logger.info('project', `Updated metadata for project ${id}`);
    return updated;
  }

  public renameProject(id: string, newName: string): Project {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length > 120) {
      throw new Error('Project name must be between 1 and 120 characters');
    }

    const existing = projectRepository.findById(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    projectRepository.update(id, { name: trimmed });
    const updated = projectRepository.findById(id)!;

    // Update project.json without changing directory path
    projectFilesystemService.writeProjectMetadataSnapshot(updated.projectPath, updated);
    logger.info('project', `Renamed project ${id} to "${trimmed}"`);
    return updated;
  }

  public duplicateProject(id: string): Project {
    const source = projectRepository.findById(id);
    if (!source) {
      throw new Error(`Cannot duplicate: Project not found: ${id}`);
    }

    const newId = uuidv4();
    const projectsRoot = appPathsService.getPaths().projects;
    const newProjectPath = path.join(projectsRoot, newId);
    const newName = this.generateUniqueCopyName(source.name);
    const now = new Date().toISOString();

    const duplicated: Project = {
      ...source,
      id: newId,
      name: newName,
      projectPath: newProjectPath,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      deletedAt: null
    };

    projectFilesystemService.createProjectStructure(newProjectPath, duplicated);
    projectRepository.insert(duplicated);

    logger.info('project', `Duplicated project ${id} -> ${newId} ("${newName}")`);
    return duplicated;
  }

  public deleteProject(id: string): boolean {
    const existing = projectRepository.findById(id);
    if (!existing) return false;

    // Section 48: Soft delete, preserve physical folder
    projectRepository.softDelete(id);
    logger.info('project', `Soft-deleted project ${id}`);
    return true;
  }

  public restoreProject(id: string): Project {
    const existing = projectRepository.findById(id, true);
    if (!existing) {
      throw new Error(`Project not found to restore: ${id}`);
    }

    projectRepository.restore(id);
    logger.info('project', `Restored soft-deleted project ${id}`);
    return projectRepository.findById(id)!;
  }

  public saveProjectText(input: SaveProjectTextInput): Project {
    const existing = projectRepository.findById(input.projectId);
    if (!existing) {
      throw new Error(`Project not found: ${input.projectId}`);
    }

    // Revision check (Section 32, 33)
    if (
      input.expectedRevision !== undefined &&
      existing.revision !== input.expectedRevision
    ) {
      logger.warn(
        'project',
        `Revision conflict on save: expected ${input.expectedRevision}, current is ${existing.revision}`
      );
      throw new Error('PROJECT_REVISION_CONFLICT');
    }

    const nextRevision = existing.revision + 1;
    const now = new Date().toISOString();

    const changes: Partial<Project> = {
      originalText: input.originalText,
      processedText: input.processedText ?? existing.processedText,
      revision: nextRevision,
      updatedAt: now
    };

    projectRepository.update(input.projectId, changes);
    const updated = projectRepository.findById(input.projectId)!;

    // Atomic write to filesystem
    projectFilesystemService.writeScriptOriginal(updated.projectPath, updated.originalText);
    projectFilesystemService.writeProjectMetadataSnapshot(updated.projectPath, updated);

    // Section 40: Clean up any intermediate recovery draft upon successful main save
    projectDraftRepository.deleteByProjectId(input.projectId);

    logger.info('project', `Saved text for project ${input.projectId} (rev ${nextRevision})`);
    return updated;
  }

  public saveDraft(input: SaveProjectDraftInput): boolean {
    try {
      projectDraftRepository.upsertDraft({
        projectId: input.projectId,
        originalText: input.originalText,
        processedText: input.processedText || '',
        revision: input.revision,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
      logger.error('project', `Error saving recovery draft for ${input.projectId}`, error);
      return false;
    }
  }

  public checkRecovery(projectId: string): ProjectDraft | null {
    const project = projectRepository.findById(projectId);
    if (!project) return null;

    const draft = projectDraftRepository.findByProjectId(projectId);
    if (!draft) return null;

    // Compare timestamps: if draft is newer than project.updatedAt, recovery is available
    if (new Date(draft.updatedAt).getTime() > new Date(project.updatedAt).getTime()) {
      logger.info('project:recovery', `Found newer recovery draft for project ${projectId}`);
      return draft;
    }

    return null;
  }

  public recoverDraft(projectId: string): Project {
    const draft = projectDraftRepository.findByProjectId(projectId);
    if (!draft) {
      throw new Error(`No recovery draft found for project ${projectId}`);
    }

    const project = this.saveProjectText({
      projectId,
      originalText: draft.originalText,
      processedText: draft.processedText
    });

    projectDraftRepository.deleteByProjectId(projectId);
    logger.info('project:recovery', `Successfully recovered draft into project ${projectId}`);
    return project;
  }

  public discardDraft(projectId: string): boolean {
    projectDraftRepository.deleteByProjectId(projectId);
    logger.info('project:recovery', `Discarded recovery draft for project ${projectId}`);
    return true;
  }

  public async openProjectFolder(projectId: string): Promise<boolean> {
    const project = projectRepository.findById(projectId);
    if (!project) return false;

    // Security validation (Sections 60, 61): Ensure projectPath is within projects root
    const projectsRoot = appPathsService.getPaths().projects;
    const resolvedPath = path.resolve(project.projectPath);

    if (!resolvedPath.startsWith(path.resolve(projectsRoot))) {
      logger.error('project', `Security violation: Path outside workspace attempted: ${resolvedPath}`);
      return false;
    }

    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    const result = await shell.openPath(resolvedPath);
    return !result;
  }

  private generateUniqueProjectName(): string {
    const baseName = 'Untitled Project';
    const projects = projectRepository.findAll();
    const existingNames = new Set(projects.map((p) => p.name));

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let counter = 2;
    while (existingNames.has(`${baseName} (${counter})`)) {
      counter++;
    }
    return `${baseName} (${counter})`;
  }

  private generateUniqueCopyName(originalName: string): string {
    const baseName = `${originalName} (Copy)`;
    const projects = projectRepository.findAll();
    const existingNames = new Set(projects.map((p) => p.name));

    if (!existingNames.has(baseName)) {
      return baseName;
    }

    let counter = 2;
    while (existingNames.has(`${originalName} (Copy ${counter})`)) {
      counter++;
    }
    return `${originalName} (Copy ${counter})`;
  }
}

export const projectService = new ProjectService();
