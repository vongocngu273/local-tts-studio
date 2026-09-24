import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { ProviderRegistry } from '../src/main/providers/provider.registry';
import { secretStorageService } from '../src/main/services/security/secretStorage.service';
import type { ProviderId } from '../src/shared/types/provider.types';

describe('ProviderRegistry & Provider Adapters', () => {
  let tempBaseDir: string;
  let registry: ProviderRegistry;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-registry-test-'));
    appPathsService.initialize(tempBaseDir);
    const dbFilePath = path.join(tempBaseDir, 'database', 'test-registry.db');
    const backupDir = path.join(tempBaseDir, 'backups');

    databaseService.initialize(dbFilePath, backupDir);
    registry = new ProviderRegistry();
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should register all 4 core TTS providers', () => {
    const providers = registry.getAll();
    const ids = providers.map((p) => p.id);

    expect(ids).toContain('edge-tts');
    expect(ids).toContain('lucylab');
    expect(ids).toContain('elevenlabs');
    expect(ids).toContain('vbee');
    expect(providers.length).toBe(4);
  });

  it('should treat Edge TTS as pre-configured without API key requirement', () => {
    const edge = registry.getProvider('edge-tts');
    expect(edge.id).toBe('edge-tts');
    expect(edge.capabilities.requiresApiKey).toBe(false);
    expect(edge.isConfigured()).toBe(true);
  });

  it('should require API key for cloud commercial providers (ElevenLabs, LucyLab, Vbee)', () => {
    const elevenlabs = registry.getProvider('elevenlabs');
    expect(elevenlabs.capabilities.requiresApiKey).toBe(true);

    // Without secret
    secretStorageService.deleteSecret('elevenlabs');
    expect(elevenlabs.isConfigured()).toBe(false);

    // With secret
    secretStorageService.setSecret('elevenlabs', 'api_key', 'xi-api-key-test');
    expect(elevenlabs.isConfigured()).toBe(true);

    secretStorageService.deleteSecret('elevenlabs');
  });

  it('should return public info list without any sensitive credentials exposed', () => {
    secretStorageService.setSecret('elevenlabs', 'api_key', 'SUPER_SECRET_KEY_123');

    const publicList = registry.getPublicInfoList();
    expect(publicList.length).toBe(4);

    for (const info of publicList) {
      expect(info).toHaveProperty('id');
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('capabilities');
      expect(info).toHaveProperty('hasApiKey');
      // Verify no plaintext key or secret leaks
      expect((info as unknown as Record<string, unknown>).api_key).toBeUndefined();
      expect((info as unknown as Record<string, unknown>).secret).toBeUndefined();
      expect((info as unknown as Record<string, unknown>).plainText).toBeUndefined();
    }

    const elevenInfo = publicList.find((p) => p.id === 'elevenlabs');
    expect(elevenInfo?.hasApiKey).toBe(true);
    expect(elevenInfo?.configured).toBe(true);

    secretStorageService.deleteSecret('elevenlabs');
  });

  it('should throw when getting an unregistered provider ID', () => {
    expect(() => registry.getProvider('unsupported-provider' as ProviderId)).toThrow(
      /is not registered in ProviderRegistry/
    );
  });

  it('should report correct capabilities for providers', () => {
    const edge = registry.getProvider('edge-tts');
    expect(edge.capabilities.supportsPitch).toBe(true);
    expect(edge.capabilities.supportsRate).toBe(true);
    expect(edge.capabilities.requiresApiKey).toBe(false);

    const eleven = registry.getProvider('elevenlabs');
    expect(eleven.capabilities.supportsTimings).toBe(true);
    expect(eleven.capabilities.requiresApiKey).toBe(true);

    const lucy = registry.getProvider('lucylab');
    expect(lucy.capabilities.supportsSrt).toBe(true);
    expect(lucy.capabilities.requiresApiKey).toBe(true);

    const vbee = registry.getProvider('vbee');
    expect(vbee.capabilities.requiresApiKey).toBe(true);
  });
});
