import { z } from 'zod';

export const ProjectStatusSchema = z.enum([
  'draft',
  'ready',
  'processing',
  'completed',
  'error'
]);

import { TextProcessingSettingsSchema } from './textProcessing.schema';

export const ProjectSettingsSchema = z.object({
  version: z.number().int().default(1),
  text: z
    .object({
      normalizationEnabled: z.boolean().optional()
    })
    .optional(),
  textProcessing: TextProcessingSettingsSchema.optional(),
  voice: z
    .object({
      speed: z.number().min(0.25).max(3.0).optional(),
      pitch: z.number().min(-100).max(100).optional(),
      volume: z.number().min(0).max(100).optional()
    })
    .optional()
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  originalText: z.string(),
  processedText: z.string(),
  providerId: z.enum(['edge-tts', 'lucylab', 'elevenlabs', 'vbee']).nullable(),
  voiceId: z.string().nullable(),
  settings: ProjectSettingsSchema,
  projectPath: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable().optional()
});

export const CreateProjectInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Project name cannot be empty')
    .max(120, 'Project name must be 120 characters or less')
    .optional(),
  description: z.string().max(1000).optional()
});

export const UpdateProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: ProjectStatusSchema.optional(),
  providerId: z.enum(['edge-tts', 'lucylab', 'elevenlabs', 'vbee']).nullable().optional(),
  voiceId: z.string().nullable().optional(),
  settings: ProjectSettingsSchema.optional()
});

export const RenameProjectInputSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1, 'Name cannot be empty').max(120, 'Max 120 characters')
});

export const SaveProjectTextSchema = z.object({
  projectId: z.string().uuid(),
  originalText: z.string(),
  processedText: z.string().optional(),
  expectedRevision: z.number().int().positive().optional()
});

export const SaveProjectDraftSchema = z.object({
  projectId: z.string().uuid(),
  originalText: z.string(),
  processedText: z.string().optional(),
  revision: z.number().int().positive().default(1)
});

export const ProjectListOptionsSchema = z.object({
  search: z.string().optional(),
  sort: z.enum(['recently_updated', 'recently_created', 'name_asc', 'name_desc']).optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
  includeDeleted: z.boolean().optional()
});

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type RenameProjectInput = z.infer<typeof RenameProjectInputSchema>;
export type SaveProjectTextInput = z.infer<typeof SaveProjectTextSchema>;
export type SaveProjectDraftInput = z.infer<typeof SaveProjectDraftSchema>;
export type ProjectListOptionsInput = z.infer<typeof ProjectListOptionsSchema>;
