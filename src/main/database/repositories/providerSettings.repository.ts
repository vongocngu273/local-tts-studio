import { databaseService } from '../database.service';
import type { ProviderSettingsRow } from '../database.types';

export class ProviderSettingsRepository {
  public get(providerId: string): ProviderSettingsRow | null {
    const db = databaseService.getConnection();
    const row = db
      .prepare('SELECT * FROM provider_settings WHERE provider_id = ?')
      .get(providerId) as ProviderSettingsRow | undefined;
    return row ?? null;
  }

  public getAll(): ProviderSettingsRow[] {
    const db = databaseService.getConnection();
    return db
      .prepare('SELECT * FROM provider_settings ORDER BY provider_id ASC')
      .all() as ProviderSettingsRow[];
  }

  public upsert(settings: {
    provider_id: string;
    enabled?: boolean;
    default_voice_id?: string | null;
    default_model_id?: string | null;
    config_json?: string;
  }): void {
    const db = databaseService.getConnection();
    const existing = this.get(settings.provider_id);
    const now = new Date().toISOString();

    if (existing) {
      db.prepare(`
        UPDATE provider_settings
        SET enabled = COALESCE(?, enabled),
            default_voice_id = COALESCE(?, default_voice_id),
            default_model_id = COALESCE(?, default_model_id),
            config_json = COALESCE(?, config_json),
            updated_at = ?
        WHERE provider_id = ?
      `).run(
        settings.enabled !== undefined ? (settings.enabled ? 1 : 0) : null,
        settings.default_voice_id !== undefined ? settings.default_voice_id : null,
        settings.default_model_id !== undefined ? settings.default_model_id : null,
        settings.config_json !== undefined ? settings.config_json : null,
        now,
        settings.provider_id
      );
    } else {
      db.prepare(`
        INSERT INTO provider_settings (
          provider_id, enabled, default_voice_id, default_model_id, config_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        settings.provider_id,
        settings.enabled !== undefined ? (settings.enabled ? 1 : 0) : 1,
        settings.default_voice_id ?? null,
        settings.default_model_id ?? null,
        settings.config_json ?? '{}',
        now,
        now
      );
    }
  }

  public setEnabled(providerId: string, enabled: boolean): void {
    const db = databaseService.getConnection();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE provider_settings
      SET enabled = ?, updated_at = ?
      WHERE provider_id = ?
    `).run(enabled ? 1 : 0, now, providerId);
  }
}

export const providerSettingsRepository = new ProviderSettingsRepository();
