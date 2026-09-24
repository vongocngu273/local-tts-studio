import type Database from 'better-sqlite3';
import { databaseService } from '../database.service';
import type { PronunciationDictionaryRow } from '../database.types';
import type {
  PronunciationRule,
  DictionaryListOptionsInput,
  ProviderScope,
  DictionaryConflictPolicy
} from '@shared/types/dictionary.types';

export class PronunciationDictionaryRepository {
  private get db(): Database.Database {
    return databaseService.getConnection();
  }

  public insert(rule: PronunciationRule): void {
    const row = this.toRow(rule);
    this.db
      .prepare(
        `INSERT INTO pronunciation_dictionary (
          id, term, spoken_text, enabled, case_sensitive, whole_word,
          provider_scope, category, priority, note, created_at, updated_at
        ) VALUES (
          @id, @term, @spoken_text, @enabled, @case_sensitive, @whole_word,
          @provider_scope, @category, @priority, @note, @created_at, @updated_at
        )`
      )
      .run(row);
  }

  public findById(id: string): PronunciationRule | null {
    const row = this.db
      .prepare('SELECT * FROM pronunciation_dictionary WHERE id = ?')
      .get(id) as PronunciationDictionaryRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public findDuplicate(
    term: string,
    caseSensitive: boolean,
    wholeWord: boolean,
    providerScope: ProviderScope,
    excludeId?: string
  ): PronunciationRule | null {
    const query = excludeId
      ? `SELECT * FROM pronunciation_dictionary 
         WHERE term = ? COLLATE NOCASE 
           AND case_sensitive = ? 
           AND whole_word = ? 
           AND provider_scope = ? 
           AND id != ?`
      : `SELECT * FROM pronunciation_dictionary 
         WHERE term = ? COLLATE NOCASE 
           AND case_sensitive = ? 
           AND whole_word = ? 
           AND provider_scope = ?`;

    const params = excludeId
      ? [term, caseSensitive ? 1 : 0, wholeWord ? 1 : 0, providerScope, excludeId]
      : [term, caseSensitive ? 1 : 0, wholeWord ? 1 : 0, providerScope];

    const row = this.db.prepare(query).get(...params) as PronunciationDictionaryRow | undefined;
    return row ? this.toModel(row) : null;
  }

  public findAll(options?: DictionaryListOptionsInput): PronunciationRule[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options?.search && options.search.trim() !== '') {
      const term = `%${options.search.trim()}%`;
      conditions.push('(term LIKE ? OR spoken_text LIKE ? OR category LIKE ? OR note LIKE ?)');
      params.push(term, term, term, term);
    }

    if (options?.category && options.category.trim() !== '') {
      conditions.push('category = ?');
      params.push(options.category.trim());
    }

    if (options?.providerScope) {
      conditions.push('provider_scope = ?');
      params.push(options.providerScope);
    }

    if (options?.enabled !== undefined) {
      conditions.push('enabled = ?');
      params.push(options.enabled ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'ORDER BY updated_at DESC';
    switch (options?.sortBy) {
      case 'term':
        orderBy = `ORDER BY term COLLATE NOCASE ${options?.sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
        break;
      case 'category':
        orderBy = `ORDER BY category COLLATE NOCASE ${options?.sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
        break;
      case 'priority':
        orderBy = `ORDER BY priority ${options?.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
        break;
      case 'updatedAt':
      default:
        orderBy = `ORDER BY updated_at ${options?.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
        break;
    }

    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;

    const sql = `SELECT * FROM pronunciation_dictionary ${whereClause} ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as PronunciationDictionaryRow[];
    return rows.map((r) => this.toModel(r));
  }

  /**
   * Retrieves all enabled rules applicable to a given provider context.
   * Rules with provider_scope = 'ALL' or matching providerScope are returned.
   */
  public findApplicableRules(providerScope: ProviderScope = 'ALL'): PronunciationRule[] {
    let sql = 'SELECT * FROM pronunciation_dictionary WHERE enabled = 1';
    const params: string[] = [];

    if (providerScope !== 'ALL') {
      sql += " AND (provider_scope = ? OR provider_scope = 'ALL')";
      params.push(providerScope);
    }

    // Sort by priority desc, term length desc (longest match), updated_at desc
    sql += ' ORDER BY priority DESC, LENGTH(term) DESC, updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as PronunciationDictionaryRow[];
    return rows.map((r) => this.toModel(r));
  }

  public update(id: string, changes: Partial<PronunciationRule>): void {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id };

    if (changes.term !== undefined) {
      fields.push('term = @term');
      params.term = changes.term;
    }
    if (changes.spokenText !== undefined) {
      fields.push('spoken_text = @spoken_text');
      params.spoken_text = changes.spokenText;
    }
    if (changes.enabled !== undefined) {
      fields.push('enabled = @enabled');
      params.enabled = changes.enabled ? 1 : 0;
    }
    if (changes.caseSensitive !== undefined) {
      fields.push('case_sensitive = @case_sensitive');
      params.case_sensitive = changes.caseSensitive ? 1 : 0;
    }
    if (changes.wholeWord !== undefined) {
      fields.push('whole_word = @whole_word');
      params.whole_word = changes.wholeWord ? 1 : 0;
    }
    if (changes.providerScope !== undefined) {
      fields.push('provider_scope = @provider_scope');
      params.provider_scope = changes.providerScope;
    }
    if (changes.category !== undefined) {
      fields.push('category = @category');
      params.category = changes.category;
    }
    if (changes.priority !== undefined) {
      fields.push('priority = @priority');
      params.priority = changes.priority;
    }
    if (changes.note !== undefined) {
      fields.push('note = @note');
      params.note = changes.note;
    }

    fields.push('updated_at = @updated_at');
    params.updated_at = new Date().toISOString();

    if (fields.length === 1) return;

    this.db
      .prepare(`UPDATE pronunciation_dictionary SET ${fields.join(', ')} WHERE id = @id`)
      .run(params);
  }

  public delete(id: string): boolean {
    const info = this.db
      .prepare('DELETE FROM pronunciation_dictionary WHERE id = ?')
      .run(id);
    return info.changes > 0;
  }

  public deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const info = this.db
      .prepare(`DELETE FROM pronunciation_dictionary WHERE id IN (${placeholders})`)
      .run(...ids);
    return info.changes;
  }

  public setEnabled(id: string, enabled: boolean): void {
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        'UPDATE pronunciation_dictionary SET enabled = ?, updated_at = ? WHERE id = ?'
      )
      .run(enabled ? 1 : 0, updatedAt, id);
  }

  public setEnabledMany(ids: string[], enabled: boolean): number {
    if (ids.length === 0) return 0;
    const updatedAt = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    const info = this.db
      .prepare(
        `UPDATE pronunciation_dictionary SET enabled = ?, updated_at = ? WHERE id IN (${placeholders})`
      )
      .run(enabled ? 1 : 0, updatedAt, ...ids);
    return info.changes;
  }

  public count(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM pronunciation_dictionary')
      .get() as { count: number };
    return row.count;
  }

  public getCategories(): string[] {
    const rows = this.db
      .prepare(
        "SELECT DISTINCT category FROM pronunciation_dictionary WHERE category IS NOT NULL AND category != '' ORDER BY category ASC"
      )
      .all() as { category: string }[];
    return rows.map((r) => r.category);
  }

  /**
   * Bulk import in an atomic transaction (Section 55).
   */
  public bulkInsert(
    rules: PronunciationRule[],
    conflictPolicy: DictionaryConflictPolicy
  ): { inserted: number; updated: number; skipped: number } {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const tx = this.db.transaction(() => {
      for (const rule of rules) {
        const existing = this.findDuplicate(
          rule.term,
          rule.caseSensitive,
          rule.wholeWord,
          rule.providerScope
        );

        if (!existing) {
          this.insert(rule);
          inserted++;
        } else if (conflictPolicy === 'replace') {
          this.update(existing.id, {
            spokenText: rule.spokenText,
            category: rule.category ?? existing.category,
            priority: rule.priority,
            note: rule.note ?? existing.note,
            enabled: rule.enabled
          });
          updated++;
        } else {
          skipped++;
        }
      }
    });

    tx();
    return { inserted, updated, skipped };
  }

  private toModel(row: PronunciationDictionaryRow): PronunciationRule {
    return {
      id: row.id,
      term: row.term,
      spokenText: row.spoken_text,
      enabled: row.enabled === 1,
      caseSensitive: row.case_sensitive === 1,
      wholeWord: row.whole_word === 1,
      providerScope: row.provider_scope as ProviderScope,
      category: row.category,
      priority: row.priority,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private toRow(model: PronunciationRule): PronunciationDictionaryRow {
    return {
      id: model.id,
      term: model.term,
      spoken_text: model.spokenText,
      enabled: model.enabled ? 1 : 0,
      case_sensitive: model.caseSensitive ? 1 : 0,
      whole_word: model.wholeWord ? 1 : 0,
      provider_scope: model.providerScope,
      category: model.category,
      priority: model.priority,
      note: model.note,
      created_at: model.createdAt,
      updated_at: model.updatedAt
    };
  }
}

export const pronunciationDictionaryRepository = new PronunciationDictionaryRepository();
