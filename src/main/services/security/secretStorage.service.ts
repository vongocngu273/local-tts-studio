import { safeStorage } from 'electron';
import { providerSecretsRepository } from '../../database/repositories/providerSecrets.repository';
import { logger } from '../logger/logger';

export class SecretStorageService {
  private sessionSecrets = new Map<string, string>();

  /**
   * Returns whether OS-level keychain / DPAPI encryption is available.
   */
  public isEncryptionAvailable(): boolean {
    try {
      return typeof safeStorage?.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Securely saves a secret.
   * If safeStorage is available, encrypts with OS keyring and saves to SQLite.
   * If safeStorage is not available, stores in-memory for the current session only.
   */
  public setSecret(providerId: string, secretName = 'api_key', plainText: string): void {
    if (!plainText || plainText.trim().length === 0) {
      this.deleteSecret(providerId, secretName);
      return;
    }

    if (this.isEncryptionAvailable()) {
      try {
        const encryptedBuffer = safeStorage.encryptString(plainText);
        const encryptedBase64 = encryptedBuffer.toString('base64');
        providerSecretsRepository.set(providerId, secretName, encryptedBase64, 1);
        this.sessionSecrets.delete(`${providerId}:${secretName}`);
        logger.info('security:secret', `Encrypted and saved secret for ${providerId}:${secretName}`);
        return;
      } catch (err) {
        logger.error('security:secret', `Failed to encrypt secret for ${providerId}:${secretName}`, err);
      }
    }

    // Fallback: In-memory session storage (NEVER write plaintext to SQLite)
    logger.warn(
      'security:secret',
      `safeStorage unavailable. Storing secret for ${providerId}:${secretName} in session memory only.`
    );
    this.sessionSecrets.set(`${providerId}:${secretName}`, plainText);
  }

  /**
   * Retrieves plaintext secret for use inside Main process TTS adapters only.
   * NEVER expose this value to Renderer!
   */
  public getSecret(providerId: string, secretName = 'api_key'): string | null {
    // Check in-memory session first
    const sessionKey = `${providerId}:${secretName}`;
    if (this.sessionSecrets.has(sessionKey)) {
      return this.sessionSecrets.get(sessionKey) ?? null;
    }

    // Check encrypted SQLite store
    const record = providerSecretsRepository.get(providerId, secretName);
    if (!record) return null;

    if (this.isEncryptionAvailable()) {
      try {
        const encryptedBuffer = Buffer.from(record.encrypted_value, 'base64');
        return safeStorage.decryptString(encryptedBuffer);
      } catch (err) {
        logger.error('security:secret', `Failed to decrypt secret for ${providerId}:${secretName}`, err);
        return null;
      }
    }

    return null;
  }

  /**
   * Returns whether a secret exists for the given provider without exposing it.
   */
  public hasSecret(providerId: string, secretName = 'api_key'): boolean {
    const sessionKey = `${providerId}:${secretName}`;
    if (this.sessionSecrets.has(sessionKey)) {
      return true;
    }
    return providerSecretsRepository.hasSecret(providerId, secretName);
  }

  /**
   * Deletes a secret from both SQLite and memory.
   */
  public deleteSecret(providerId: string, secretName = 'api_key'): boolean {
    const memoryDeleted = this.sessionSecrets.delete(`${providerId}:${secretName}`);
    const repoDeleted = providerSecretsRepository.delete(providerId, secretName);
    return memoryDeleted || repoDeleted;
  }
}

export const secretStorageService = new SecretStorageService();
