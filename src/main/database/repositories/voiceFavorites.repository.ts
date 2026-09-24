import { databaseService } from '../database.service';
import type { VoiceFavoriteRow } from '../database.types';
import type { ProviderId } from '@shared/types/provider.types';

export class VoiceFavoritesRepository {
  public isFavorite(providerId: string, voiceId: string): boolean {
    const db = databaseService.getConnection();
    const row = db
      .prepare('SELECT 1 FROM voice_favorites WHERE provider_id = ? AND voice_id = ?')
      .get(providerId, voiceId);
    return Boolean(row);
  }

  public toggle(providerId: string, voiceId: string): boolean {
    const db = databaseService.getConnection();
    const exists = this.isFavorite(providerId, voiceId);
    if (exists) {
      db.prepare('DELETE FROM voice_favorites WHERE provider_id = ? AND voice_id = ?').run(
        providerId,
        voiceId
      );
      return false;
    } else {
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO voice_favorites (provider_id, voice_id, created_at) VALUES (?, ?, ?)'
      ).run(providerId, voiceId, now);
      return true;
    }
  }

  public getAll(): { providerId: ProviderId; voiceId: string }[] {
    const db = databaseService.getConnection();
    const rows = db
      .prepare('SELECT provider_id, voice_id FROM voice_favorites ORDER BY created_at DESC')
      .all() as VoiceFavoriteRow[];
    return rows.map((r) => ({
      providerId: r.provider_id as ProviderId,
      voiceId: r.voice_id
    }));
  }

  public getAllSet(): Set<string> {
    const favorites = this.getAll();
    return new Set(favorites.map((f) => `${f.providerId}:${f.voiceId}`));
  }
}

export const voiceFavoritesRepository = new VoiceFavoritesRepository();
