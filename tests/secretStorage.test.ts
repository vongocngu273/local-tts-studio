import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { databaseService } from '../src/main/database/database.service';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { SecretStorageService } from '../src/main/services/security/secretStorage.service';
import { providerSecretsRepository } from '../src/main/database/repositories/providerSecrets.repository';

describe('SecretStorageService & Credential Security', () => {
  let tempBaseDir: string;
  let secretService: SecretStorageService;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-secret-test-'));
    appPathsService.initialize(tempBaseDir);
    const dbFilePath = path.join(tempBaseDir, 'database', 'test-secrets.db');
    const backupDir = path.join(tempBaseDir, 'backups');

    databaseService.initialize(dbFilePath, backupDir);
    secretService = new SecretStorageService();
  });

  afterEach(() => {
    databaseService.close();
    if (fs.existsSync(tempBaseDir)) {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    }
  });

  it('should store and retrieve secrets using in-memory session fallback when safeStorage is unconfigured in test', () => {
    const providerId = 'elevenlabs';
    const apiKey = 'sk_test_1234567890abcdef';

    expect(secretService.hasSecret(providerId)).toBe(false);
    expect(secretService.getSecret(providerId)).toBeNull();

    // Store secret
    secretService.setSecret(providerId, 'api_key', apiKey);

    expect(secretService.hasSecret(providerId)).toBe(true);
    expect(secretService.getSecret(providerId)).toBe(apiKey);
  });

  it('should clear secret when setSecret is called with empty string', () => {
    const providerId = 'vbee';
    secretService.setSecret(providerId, 'api_key', 'my-vbee-secret-token');
    expect(secretService.hasSecret(providerId)).toBe(true);

    secretService.setSecret(providerId, 'api_key', '');
    expect(secretService.hasSecret(providerId)).toBe(false);
    expect(secretService.getSecret(providerId)).toBeNull();
  });

  it('should delete secret from both memory and repository', () => {
    const providerId = 'lucylab';
    secretService.setSecret(providerId, 'api_key', 'lucy-api-key-999');
    expect(secretService.hasSecret(providerId)).toBe(true);

    const deleted = secretService.deleteSecret(providerId, 'api_key');
    expect(deleted).toBe(true);
    expect(secretService.hasSecret(providerId)).toBe(false);
    expect(secretService.getSecret(providerId)).toBeNull();
  });

  it('should manipulate providerSecretsRepository with encrypted base64 payload', () => {
    const providerId = 'test-provider';
    const fakeEncrypted = Buffer.from('encrypted_binary_payload').toString('base64');

    providerSecretsRepository.set(providerId, 'token', fakeEncrypted, 1);
    expect(providerSecretsRepository.hasSecret(providerId, 'token')).toBe(true);

    const record = providerSecretsRepository.get(providerId, 'token');
    expect(record).not.toBeNull();
    expect(record?.encrypted_value).toBe(fakeEncrypted);
    expect(record?.encryption_version).toBe(1);

    const configuredProviders = providerSecretsRepository.listConfiguredProviders();
    expect(configuredProviders).toContain(providerId);

    providerSecretsRepository.delete(providerId, 'token');
    expect(providerSecretsRepository.hasSecret(providerId, 'token')).toBe(false);
  });
});
