import { describe, it, expect } from 'vitest';
import { SystemInfoService } from '../src/main/services/system/systemInfo.service';
import { SystemInfoSchema, FFmpegStatusSchema } from '../src/shared/schemas/system.schema';

describe('SystemInfoService', () => {
  const service = new SystemInfoService();

  it('should return hardware diagnostic metrics matching SystemInfoSchema', () => {
    const info = service.getSystemInfo();
    const result = SystemInfoSchema.safeParse(info);

    expect(result.success).toBe(true);
    expect(info.cpuCores).toBeGreaterThan(0);
    expect(info.totalRamBytes).toBeGreaterThan(0);
    expect(info.os).toBeTruthy();
    expect(info.platform).toBeTruthy();
    expect(info.arch).toBeTruthy();
    expect(info.localProcessingReady).toBe(true);
  });

  it('should not contain any PII or hardware identifiers like MAC or IP', () => {
    const info = service.getSystemInfo();
    const jsonString = JSON.stringify(info);

    expect(jsonString).not.toContain('macAddress');
    expect(jsonString).not.toContain('ipAddress');
    expect(jsonString).not.toContain('serialNumber');
    expect(jsonString).not.toContain('machineId');
  });

  it('should return FFmpegStatus satisfying FFmpegStatusSchema and not fake available=true', () => {
    const status = service.getFFmpegStatus();
    const result = FFmpegStatusSchema.safeParse(status);

    expect(result.success).toBe(true);
    expect(status.available).toBe(false);
  });
});
