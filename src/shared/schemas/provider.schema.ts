import { z } from 'zod';

export const ProviderIdSchema = z.enum(['edge-tts', 'lucylab', 'elevenlabs', 'vbee']);

export const VoiceGenderSchema = z.enum(['male', 'female', 'neutral']);

export const VoiceSettingsSchema = z.object({
  speed: z.number().min(0.25).max(3.0).optional().default(1.0),
  pitch: z.number().min(-100).max(100).optional().default(0),
  volume: z.number().min(0).max(100).optional().default(100),
  modelId: z.string().optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  useSpeakerBoost: z.boolean().optional(),
  extra: z.record(z.unknown()).optional()
});

export const SetProviderSecretInputSchema = z.object({
  providerId: ProviderIdSchema,
  secretName: z.string().min(1),
  secretValue: z.string()
});

export const UpdateProviderSettingsInputSchema = z.object({
  providerId: ProviderIdSchema,
  enabled: z.boolean().optional(),
  defaultVoiceId: z.string().nullable().optional(),
  defaultModelId: z.string().nullable().optional(),
  config: z.record(z.unknown()).optional()
});

export const VoiceFilterOptionsSchema = z.object({
  providerId: z.union([ProviderIdSchema, z.literal('ALL')]).optional(),
  locale: z.string().optional(),
  gender: z.union([VoiceGenderSchema, z.literal('ALL')]).optional(),
  search: z.string().optional(),
  favoritesOnly: z.boolean().optional()
});

export const VoicePreviewRequestSchema = z.object({
  providerId: ProviderIdSchema,
  voiceId: z.string().min(1),
  text: z.string().max(500).optional(),
  settings: VoiceSettingsSchema.optional()
});

export const ProjectAudioGenerateRequestSchema = z.object({
  projectId: z.string().uuid(),
  providerId: ProviderIdSchema.optional(),
  voiceId: z.string().optional(),
  settings: VoiceSettingsSchema.optional()
});

