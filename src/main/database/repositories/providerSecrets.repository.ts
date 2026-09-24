import { databaseService } from '../database.service';
import type { ProviderSecretRow } from '../database.types';

export class ProviderSecretsRepository {
  public get(providerId: string, secretName: string): ProviderSecretRow | null {
    const db = databaseService.getConnection();
    const row = db
      .prepare('SELECT * FROM provider_secrets WHERE provider_id = ? AND secret_name = ?')
      .get(providerId, secretName) as ProviderSecretRow | undefined;
    return row ?? null;
  }

  public hasSecret(providerId: string, secretName = 'api_key'): boolean {
    const db = databaseService.getConnection();
    const row = db
      .prepare('SELECT 1 FROM provider_secrets WHERE provider_id = ? AND secret_name = ?')
      .get(providerId, secretName);
    return Boolean(row);
  }

  public set(providerId: string, secretName: string, encryptedValue: string, version = 1): void {
    const db = databaseService.getConnection();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO provider_secrets (provider_id, secret_name, encrypted_value, encryption_version, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider_id, secret_name) DO UPDATE SET
        encrypted_value = excluded.encrypted_value,
        encryption_version = excluded.encryption_version,
        updated_at = excluded.updated_at
    `).run(providerId, secretName, encryptedValue, version, now);
  }

  public delete(providerId: string, secretName?: string): boolean {
    const db = databaseService.getConnection();
    if (secretName) {
      const info = db
        .prepare('DELETE FROM provider_secrets WHERE provider_id = ? AND secret_name = ?')
        .run(providerId, secretName);
      return info.changes > 0;
    } else {
      const info = db
        .prepare('DELETE FROM provider_secrets WHERE provider_id = ?')
        .run(providerId);
      return info.changes > 0;
    }
  }

  public listConfiguredProviders(): string[] {
    const db = databaseService.getConnection();
    const rows = db
      .prepare('SELECT DISTINCT provider_id FROM provider_secrets')
      .all() as { provider_id: string }[];
    return rows.map((r) => r.provider_id);
  }
}

export const providerSecretsRepository = new ProviderSecretsRepository();
