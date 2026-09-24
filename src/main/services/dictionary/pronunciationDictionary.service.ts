import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { dialog } from 'electron';
import { pronunciationDictionaryRepository } from '../../database/repositories/pronunciationDictionary.repository';
import { appMetadataRepository } from '../../database/repositories/appMetadata.repository';
import {
  CreatePronunciationRuleSchema,
  UpdatePronunciationRuleSchema,
  DictionaryListOptionsSchema
} from '@shared/schemas/dictionary.schema';
import type {
  PronunciationRule,
  CreatePronunciationRuleInput,
  UpdatePronunciationRuleInput,
  DictionaryListOptionsInput,
  DictionaryImportInput,
  DictionaryImportPreviewResult,
  DictionaryExportInput,
  ProviderScope
} from '@shared/types/dictionary.types';
import { logger } from '../logger/logger';
import { dictionaryMatcher } from '../text-processing/matcher/dictionaryMatcher';

export class PronunciationDictionaryService {
  public createRule(input: CreatePronunciationRuleInput): PronunciationRule {
    const validated = CreatePronunciationRuleSchema.parse(input);

    const term = validated.term.trim();
    const caseSensitive = validated.caseSensitive ?? false;
    const wholeWord = validated.wholeWord ?? true;
    const providerScope = validated.providerScope ?? 'ALL';

    // Duplicate detection (Section 21)
    const existing = pronunciationDictionaryRepository.findDuplicate(
      term,
      caseSensitive,
      wholeWord,
      providerScope
    );

    if (existing) {
      logger.warn('dictionary', `Duplicate rule attempted for term "${term}"`);
      throw new Error('DICTIONARY_RULE_ALREADY_EXISTS');
    }

    const now = new Date().toISOString();
    const newRule: PronunciationRule = {
      id: uuidv4(),
      term,
      spokenText: validated.spokenText.trim(),
      enabled: validated.enabled ?? true,
      caseSensitive,
      wholeWord,
      providerScope,
      category: validated.category?.trim() || null,
      priority: validated.priority ?? 0,
      note: validated.note?.trim() || null,
      createdAt: now,
      updatedAt: now
    };

    pronunciationDictionaryRepository.insert(newRule);
    appMetadataRepository.incrementDictionaryRevision();

    logger.info('dictionary', `Created rule ${newRule.id} for term "${newRule.term}"`);
    return newRule;
  }

  public getRule(id: string): PronunciationRule | null {
    return pronunciationDictionaryRepository.findById(id);
  }

  public listRules(options?: DictionaryListOptionsInput): PronunciationRule[] {
    const validated = options ? DictionaryListOptionsSchema.parse(options) : undefined;
    return pronunciationDictionaryRepository.findAll(validated);
  }

  public updateRule(id: string, changes: UpdatePronunciationRuleInput): PronunciationRule {
    const validated = UpdatePronunciationRuleSchema.parse(changes);
    const existing = pronunciationDictionaryRepository.findById(id);
    if (!existing) {
      throw new Error('RULE_NOT_FOUND');
    }

    const targetTerm = validated.term !== undefined ? validated.term.trim() : existing.term;
    const targetCase = validated.caseSensitive !== undefined ? validated.caseSensitive : existing.caseSensitive;
    const targetWholeWord = validated.wholeWord !== undefined ? validated.wholeWord : existing.wholeWord;
    const targetProvider = validated.providerScope !== undefined ? validated.providerScope : existing.providerScope;

    // Check duplicate against other rules
    const duplicate = pronunciationDictionaryRepository.findDuplicate(
      targetTerm,
      targetCase,
      targetWholeWord,
      targetProvider,
      id
    );

    if (duplicate) {
      throw new Error('DICTIONARY_RULE_ALREADY_EXISTS');
    }

    const sanitizedChanges: Partial<PronunciationRule> = {};
    if (validated.term !== undefined) sanitizedChanges.term = validated.term.trim();
    if (validated.spokenText !== undefined) sanitizedChanges.spokenText = validated.spokenText.trim();
    if (validated.enabled !== undefined) sanitizedChanges.enabled = validated.enabled;
    if (validated.caseSensitive !== undefined) sanitizedChanges.caseSensitive = validated.caseSensitive;
    if (validated.wholeWord !== undefined) sanitizedChanges.wholeWord = validated.wholeWord;
    if (validated.providerScope !== undefined) sanitizedChanges.providerScope = validated.providerScope;
    if (validated.category !== undefined) sanitizedChanges.category = validated.category?.trim() || null;
    if (validated.priority !== undefined) sanitizedChanges.priority = validated.priority;
    if (validated.note !== undefined) sanitizedChanges.note = validated.note?.trim() || null;

    pronunciationDictionaryRepository.update(id, sanitizedChanges);
    appMetadataRepository.incrementDictionaryRevision();

    logger.info('dictionary', `Updated rule ${id}`);
    return pronunciationDictionaryRepository.findById(id)!;
  }

  public deleteRule(id: string): boolean {
    const deleted = pronunciationDictionaryRepository.delete(id);
    if (deleted) {
      appMetadataRepository.incrementDictionaryRevision();
      logger.info('dictionary', `Deleted rule ${id}`);
    }
    return deleted;
  }

  public deleteManyRules(ids: string[]): number {
    const count = pronunciationDictionaryRepository.deleteMany(ids);
    if (count > 0) {
      appMetadataRepository.incrementDictionaryRevision();
      logger.info('dictionary', `Deleted ${count} rules`);
    }
    return count;
  }

  public setEnabled(id: string, enabled: boolean): boolean {
    const existing = pronunciationDictionaryRepository.findById(id);
    if (!existing) return false;

    pronunciationDictionaryRepository.setEnabled(id, enabled);
    appMetadataRepository.incrementDictionaryRevision();
    logger.info('dictionary', `Rule ${id} enabled set to ${enabled}`);
    return true;
  }

  public setEnabledMany(ids: string[], enabled: boolean): number {
    const count = pronunciationDictionaryRepository.setEnabledMany(ids, enabled);
    if (count > 0) {
      appMetadataRepository.incrementDictionaryRevision();
      logger.info('dictionary', `Updated enabled for ${count} rules`);
    }
    return count;
  }

  public getCategories(): string[] {
    return pronunciationDictionaryRepository.getCategories();
  }

  public getRevision(): number {
    return appMetadataRepository.getDictionaryRevision();
  }

  /**
   * Preview import results without mutating database (Section 53).
   */
  public previewImport(input: DictionaryImportInput): DictionaryImportPreviewResult {
    const parsedRows = this.parseImportContent(input.format, input.content);

    const conflicts: DictionaryImportPreviewResult['conflicts'] = [];
    const invalidRows: DictionaryImportPreviewResult['invalidRows'] = [];
    let newCount = 0;

    parsedRows.forEach((row, index) => {
      const parsed = CreatePronunciationRuleSchema.safeParse(row);
      if (!parsed.success) {
        invalidRows.push({
          row: index + 1,
          reason: parsed.error.issues.map((i) => i.message).join(', '),
          data: row
        });
        return;
      }

      const item = parsed.data;
      const existing = pronunciationDictionaryRepository.findDuplicate(
        item.term,
        item.caseSensitive ?? false,
        item.wholeWord ?? true,
        item.providerScope ?? 'ALL'
      );

      if (existing) {
        conflicts.push({
          term: item.term,
          existingRule: existing,
          incomingRule: item
        });
      } else {
        newCount++;
      }
    });

    return {
      total: parsedRows.length,
      newCount,
      conflictCount: conflicts.length,
      invalidCount: invalidRows.length,
      conflicts,
      invalidRows
    };
  }

  /**
   * Executes atomic bulk import (Section 55).
   */
  public executeImport(
    input: DictionaryImportInput
  ): { inserted: number; updated: number; skipped: number } {
    const parsedRows = this.parseImportContent(input.format, input.content);
    const validRules: PronunciationRule[] = [];
    const now = new Date().toISOString();

    for (const row of parsedRows) {
      const parsed = CreatePronunciationRuleSchema.safeParse(row);
      if (parsed.success) {
        const item = parsed.data;
        validRules.push({
          id: uuidv4(),
          term: item.term,
          spokenText: item.spokenText,
          enabled: item.enabled ?? true,
          caseSensitive: item.caseSensitive ?? false,
          wholeWord: item.wholeWord ?? true,
          providerScope: item.providerScope ?? 'ALL',
          category: item.category ?? null,
          priority: item.priority ?? 0,
          note: item.note ?? null,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    const result = pronunciationDictionaryRepository.bulkInsert(validRules, input.conflictPolicy);

    if (result.inserted > 0 || result.updated > 0) {
      appMetadataRepository.incrementDictionaryRevision();
      logger.info(
        'dictionary',
        `Import completed: inserted ${result.inserted}, updated ${result.updated}, skipped ${result.skipped}`
      );
    }

    return result;
  }

  public exportToString(input: DictionaryExportInput): string {
    const rules = pronunciationDictionaryRepository.findAll({
      category: input.category,
      providerScope: input.providerScope,
      limit: 100000
    });

    return input.format === 'json' ? this.formatJsonExport(rules) : this.formatCsvExport(rules);
  }

  /**
   * Prompts native save dialog to export rules to JSON or CSV (Sections 50, 51, 57).
   */
  public async exportToFile(input: DictionaryExportInput): Promise<boolean> {
    const rules = pronunciationDictionaryRepository.findAll({
      category: input.category,
      providerScope: input.providerScope,
      limit: 100000
    });

    const isJson = input.format === 'json';
    const extension = isJson ? 'json' : 'csv';
    const defaultName = `pronunciation-dictionary-${new Date().toISOString().slice(0, 10)}.${extension}`;

    const saveDialog = await dialog.showSaveDialog({
      title: 'Export Pronunciation Dictionary',
      defaultPath: defaultName,
      filters: isJson
        ? [{ name: 'JSON Files', extensions: ['json'] }]
        : [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return false;
    }

    const content = isJson ? this.formatJsonExport(rules) : this.formatCsvExport(rules);
    fs.writeFileSync(saveDialog.filePath, content, 'utf8');

    logger.info('dictionary', `Exported ${rules.length} rules to ${saveDialog.filePath}`);
    return true;
  }

  /**
   * Prompts native open dialog to select JSON or CSV for import (Section 58).
   */
  public async selectImportFile(): Promise<{ content: string; format: 'json' | 'csv'; filePath: string } | null> {
    const openDialog = await dialog.showOpenDialog({
      title: 'Select Pronunciation Dictionary File',
      filters: [
        { name: 'Supported Formats (*.json, *.csv)', extensions: ['json', 'csv'] },
        { name: 'JSON Files (*.json)', extensions: ['json'] },
        { name: 'CSV Files (*.csv)', extensions: ['csv'] }
      ],
      properties: ['openFile']
    });

    if (openDialog.canceled || openDialog.filePaths.length === 0) {
      return null;
    }

    const filePath = openDialog.filePaths[0];
    const format = filePath.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
    const content = fs.readFileSync(filePath, 'utf8');

    return { content, format, filePath };
  }

  public formatJsonExport(rules: PronunciationRule[]): string {
    const exportData = {
      format: 'local-tts-pronunciation-dictionary',
      version: 1,
      exportedAt: new Date().toISOString(),
      rules: rules.map((r) => ({
        term: r.term,
        spokenText: r.spokenText,
        enabled: r.enabled,
        caseSensitive: r.caseSensitive,
        wholeWord: r.wholeWord,
        providerScope: r.providerScope,
        category: r.category,
        priority: r.priority,
        note: r.note
      }))
    };
    return JSON.stringify(exportData, null, 2);
  }

  public formatCsvExport(rules: PronunciationRule[]): string {
    const headers = [
      'term',
      'spoken_text',
      'enabled',
      'case_sensitive',
      'whole_word',
      'provider_scope',
      'category',
      'priority',
      'note'
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = rules.map((r) => [
      escapeCsv(r.term),
      escapeCsv(r.spokenText),
      escapeCsv(r.enabled),
      escapeCsv(r.caseSensitive),
      escapeCsv(r.wholeWord),
      escapeCsv(r.providerScope),
      escapeCsv(r.category),
      escapeCsv(r.priority),
      escapeCsv(r.note)
    ].join(','));

    // UTF-8 BOM (\uFEFF) for Excel compatibility with Vietnamese Unicode
    return `\uFEFF${headers.join(',')}\n${rows.join('\n')}`;
  }

  public parseImportContent(format: 'json' | 'csv', content: string): unknown[] {
    if (format === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (parsed && Array.isArray(parsed.rules)) {
          return parsed.rules;
        }
        throw new Error('Invalid JSON dictionary format: missing rules array');
      } catch (err) {
        throw new Error(`JSON parse error: ${String(err)}`);
      }
    }

    // CSV parser
    return this.parseCsv(content);
  }

  private parseCsv(content: string): Record<string, unknown>[] {
    // Strip UTF-8 BOM if present
    const cleanContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
    const lines = this.splitCsvLines(cleanContent);
    if (lines.length < 2) return [];

    const headers = this.parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
    const results: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = this.parseCsvRow(line);
      const rowObj: Record<string, unknown> = {};

      headers.forEach((header, idx) => {
        const val = cells[idx] !== undefined ? cells[idx].trim() : '';

        if (header === 'term') rowObj.term = val;
        else if (header === 'spoken_text' || header === 'spokentext') rowObj.spokenText = val;
        else if (header === 'enabled') rowObj.enabled = val === 'true' || val === '1';
        else if (header === 'case_sensitive' || header === 'casesensitive') rowObj.caseSensitive = val === 'true' || val === '1';
        else if (header === 'whole_word' || header === 'wholeword') rowObj.wholeWord = val !== 'false' && val !== '0';
        else if (header === 'provider_scope' || header === 'providerscope') rowObj.providerScope = (val.toUpperCase() || 'ALL') as ProviderScope;
        else if (header === 'category') rowObj.category = val || null;
        else if (header === 'priority') rowObj.priority = parseInt(val, 10) || 0;
        else if (header === 'note') rowObj.note = val || null;
      });

      results.push(rowObj);
    }

    return results;
  }

  private splitCsvLines(csv: string): string[] {
    const lines: string[] = [];
    let currentLine = '';
    let insideQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
        currentLine += char;
      } else if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && csv[i + 1] === '\n') {
          i++; // skip LF
        }
        lines.push(currentLine);
        currentLine = '';
      } else {
        currentLine += char;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private parseCsvRow(row: string): string[] {
    const cells: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        if (insideQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    cells.push(current);
    return cells;
  }

  public testRule(input: {
    rule: CreatePronunciationRuleInput;
    sampleText: string;
  }): { original: string; processed: string; matched: boolean } {
    const mockRule: PronunciationRule = {
      ...input.rule,
      id: 'test-rule-id',
      enabled: true,
      caseSensitive: input.rule.caseSensitive ?? false,
      wholeWord: input.rule.wholeWord ?? true,
      providerScope: input.rule.providerScope ?? 'ALL',
      category: input.rule.category ?? null,
      priority: input.rule.priority ?? 0,
      note: input.rule.note ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = dictionaryMatcher.matchAndReplace(
      input.sampleText,
      [mockRule],
      input.rule.providerScope ?? 'ALL'
    );

    return {
      original: input.sampleText,
      processed: result.text,
      matched: result.matchCount > 0
    };
  }
}

export const pronunciationDictionaryService = new PronunciationDictionaryService();
