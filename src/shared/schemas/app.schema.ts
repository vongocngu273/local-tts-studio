import { z } from 'zod';

export const AppInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  appId: z.string().min(1)
});

export const AppPathsSchema = z.object({
  root: z.string().min(1),
  database: z.string().min(1),
  projects: z.string().min(1),
  cache: z.string().min(1),
  logs: z.string().min(1),
  backups: z.string().min(1),
  temp: z.string().min(1)
});

export type AppInfo = z.infer<typeof AppInfoSchema>;
export type AppPaths = z.infer<typeof AppPathsSchema>;
