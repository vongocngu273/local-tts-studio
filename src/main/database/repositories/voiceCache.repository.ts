import { databaseService } from '../database.service';
import type { TtsVoiceCacheRow } from '../database.types';
import type { VoiceDefinition, VoiceFilterOptions, ProviderId, VoiceGender } from '@shared/types/provider.types';
import { voiceFavoritesRepository } from './voiceFavorites.repository';

export class VoiceCacheRepository {
  public upsertMany(voices: VoiceDefinition[]): void {
    if (voices.length === 0) return;
    const db = databaseService.getConnection();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO tts_voice_cache (
        provider_id, voice_id, name, locale, language, gender, description, metadata_json, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_id, voice_id) DO UPDATE SET
        name = excluded.name,
        locale = excluded.locale,
        language = excluded.language,
        gender = excluded.gender,
        description = excluded.description,
        metadata_json = excluded.metadata_json,
        cached_at = excluded.cached_at
    `);

    const tx = db.transaction((list: VoiceDefinition[]) => {
      for (const v of list) {
        stmt.run(
          v.providerId,
          v.id,
          v.name,
          v.locale,
          v.language,
          v.gender,
          v.description ?? null,
          v.metadata ? JSON.stringify(v.metadata) : '{}',
          now
        );
      }
    });

    tx(voices);
  }

  public list(filter?: VoiceFilterOptions): VoiceDefinition[] {
    const db = databaseService.getConnection();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.providerId && filter.providerId !== 'ALL') {
      conditions.push('provider_id = ?');
      params.push(filter.providerId);
    }

    if (filter?.locale) {
      conditions.push('locale LIKE ?');
      params.push(`%${filter.locale}%`);
    }

    if (filter?.gender && filter.gender !== 'ALL') {
      conditions.push('gender = ?');
      params.push(filter.gender.toLowerCase());
    }

    if (filter?.search?.trim()) {
      const q = `%${filter.search.trim()}%`;
      conditions.push('(name LIKE ? OR description LIKE ? OR locale LIKE ?)');
      params.push(q, q, q);
    }

    let query = 'SELECT * FROM tts_voice_cache';
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY locale ASC, name ASC';

    const rows = db.prepare(query).all(...params) as TtsVoiceCacheRow[];
    const favorites = voiceFavoritesRepository.getAllSet();

    const results = rows.map((row) => this.mapRowToDefinition(row, favorites));

    if (filter?.favoritesOnly) {
      return results.filter((v) => v.isFavorite);
    }

    return results;
  }

  public getByProviderAndId(providerId: string, voiceId: string): VoiceDefinition | null {
    const db = databaseService.getConnection();
    const row = db
      .prepare('SELECT * FROM tts_voice_cache WHERE provider_id = ? AND voice_id = ?')
      .get(providerId, voiceId) as TtsVoiceCacheRow | undefined;

    if (!row) return null;
    const isFav = voiceFavoritesRepository.isFavorite(providerId, voiceId);
    return this.mapRowToDefinition(row, undefined, isFav);
  }

  public countByProvider(providerId: string): number {
    const db = databaseService.getConnection();
    const row = db
      .prepare('SELECT COUNT(*) as count FROM tts_voice_cache WHERE provider_id = ?')
      .get(providerId) as { count: number };
    return row?.count ?? 0;
  }

  public clearProvider(providerId: string): void {
    const db = databaseService.getConnection();
    db.prepare('DELETE FROM tts_voice_cache WHERE provider_id = ?').run(providerId);
  }

  private mapRowToDefinition(
    row: TtsVoiceCacheRow,
    favoriteSet?: Set<string>,
    directFavorite?: boolean
  ): VoiceDefinition {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(row.metadata_json);
    } catch {
      // keep empty
    }

    const key = `${row.provider_id}:${row.voice_id}`;
    const isFavorite = directFavorite !== undefined
      ? directFavorite
      : favoriteSet ? favoriteSet.has(key) : false;

    return {
      id: row.voice_id,
      providerId: row.provider_id as ProviderId,
      name: row.name,
      locale: row.locale,
      language: row.language,
      gender: (row.gender?.toLowerCase() as VoiceGender) || 'neutral',
      description: row.description ?? undefined,
      sampleRate: typeof metadata.sampleRate === 'number' ? metadata.sampleRate : undefined,
      isFavorite,
      metadata
    };
  }
}

export const voiceCacheRepository = new VoiceCacheRepository();
