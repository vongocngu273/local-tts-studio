import { z } from 'zod';

export const SystemInfoSchema = z.object({
  os: z.string().min(1),
  platform: z.string().min(1),
  arch: z.string().min(1),
  cpuModel: z.string().min(1),
  cpuCores: z.number().int().positive(),
  totalRamBytes: z.number().nonnegative(),
  freeRamBytes: z.number().nonnegative(),
  totalRamFormatted: z.string().min(1),
  freeRamFormatted: z.string().min(1),
  appVersion: z.string().min(1),
  electronVersion: z.string().min(1),
  nodeVersion: z.string().min(1),
  localProcessingReady: z.boolean()
});

export const FFmpegStatusSchema = z.object({
  available: z.boolean(),
  path: z.string().optional(),
  version: z.string().optional(),
  error: z.string().optional()
});

export type SystemInfo = z.infer<typeof SystemInfoSchema>;
export type FFmpegStatus = z.infer<typeof FFmpegStatusSchema>;
