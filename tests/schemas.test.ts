import { describe, it, expect } from 'vitest';
import { AppInfoSchema, AppPathsSchema } from '../src/shared/schemas/app.schema';
import { SystemInfoSchema, FFmpegStatusSchema } from '../src/shared/schemas/system.schema';

describe('Shared Zod Schemas', () => {
  it('should validate valid AppInfo and reject invalid AppInfo', () => {
    const valid = {
      name: 'Local TTS Studio',
      version: '0.1.0',
      appId: 'com.localtts.studio'
    };
    expect(AppInfoSchema.safeParse(valid).success).toBe(true);

    const invalid = {
      name: '',
      version: '0.1.0'
    };
    expect(AppInfoSchema.safeParse(invalid).success).toBe(false);
  });

  it('should validate complete AppPaths and reject missing paths', () => {
    const valid = {
      root: '/data/app',
      database: '/data/app/database',
      projects: '/data/app/projects',
      cache: '/data/app/cache',
      logs: '/data/app/logs',
      backups: '/data/app/backups',
      temp: '/data/app/temp'
    };
    expect(AppPathsSchema.safeParse(valid).success).toBe(true);

    const incomplete = {
      root: '/data/app',
      database: '/data/app/database'
    };
    expect(AppPathsSchema.safeParse(incomplete).success).toBe(false);
  });

  it('should validate SystemInfoSchema types and ranges', () => {
    const valid = {
      os: 'macOS (23.4.0)',
      platform: 'darwin',
      arch: 'arm64',
      cpuModel: 'Apple M3 Pro',
      cpuCores: 12,
      totalRamBytes: 38654705664,
      freeRamBytes: 15000000000,
      totalRamFormatted: '36.0 GB',
      freeRamFormatted: '14.0 GB',
      appVersion: '0.1.0',
      electronVersion: '33.2.1',
      nodeVersion: '20.18.0',
      localProcessingReady: true
    };
    expect(SystemInfoSchema.safeParse(valid).success).toBe(true);

    // Negative cores or missing fields should fail
    const invalid = {
      ...valid,
      cpuCores: -1
    };
    expect(SystemInfoSchema.safeParse(invalid).success).toBe(false);
  });

  it('should validate FFmpegStatusSchema', () => {
    expect(FFmpegStatusSchema.safeParse({ available: false }).success).toBe(true);
    expect(FFmpegStatusSchema.safeParse({ available: true, version: '6.1.1', path: '/usr/local/bin/ffmpeg' }).success).toBe(true);
    expect(FFmpegStatusSchema.safeParse({ available: 'yes' }).success).toBe(false);
  });
});
