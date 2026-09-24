import os from 'os';
import { app } from 'electron';
import type { SystemInfo, FFmpegStatus } from '@shared/schemas/system.schema';
import { APP_VERSION } from '@shared/constants/app.constants';

export class SystemInfoService {
  /**
   * Retrieves clean, non-identifiable system hardware specs.
   * Strictly avoids MAC address, IP, serial numbers, machine IDs, or usernames.
   */
  public getSystemInfo(): SystemInfo {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown CPU';
    const cpuCores = cpus.length || 1;
    const totalRamBytes = os.totalmem();
    const freeRamBytes = os.freemem();

    let appVersion = APP_VERSION;
    try {
      if (typeof app !== 'undefined' && typeof app.getVersion === 'function') {
        appVersion = app.getVersion();
      }
    } catch {
      // Fallback in test environments
      appVersion = APP_VERSION;
    }

    return {
      os: this.getFriendlyOsName(),
      platform: os.platform(),
      arch: os.arch(),
      cpuModel,
      cpuCores,
      totalRamBytes,
      freeRamBytes,
      totalRamFormatted: this.formatBytes(totalRamBytes),
      freeRamFormatted: this.formatBytes(freeRamBytes),
      appVersion,
      electronVersion: process.versions.electron || 'unknown',
      nodeVersion: process.versions.node || process.version,
      localProcessingReady: true
    };
  }

  /**
   * Section 29: FFmpeg status contract.
   * Phase 1 returns available = false until bundled in future phases.
   */
  public getFFmpegStatus(): FFmpegStatus {
    return {
      available: false,
      version: undefined,
      path: undefined
    };
  }

  private getFriendlyOsName(): string {
    const platform = os.platform();
    const release = os.release();

    switch (platform) {
      case 'darwin':
        return `macOS (${release})`;
      case 'win32':
        return `Windows (${release})`;
      case 'linux':
        return `Linux (${release})`;
      default:
        return `${platform} (${release})`;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 GB';
    const gigabytes = bytes / (1024 * 1024 * 1024);
    return `${gigabytes.toFixed(1)} GB`;
  }
}

export const systemInfoService = new SystemInfoService();
