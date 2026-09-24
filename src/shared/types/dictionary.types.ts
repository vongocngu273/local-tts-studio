export type ProviderScope = 'ALL' | 'EDGE' | 'LUCYLAB' | 'ELEVENLABS' | 'VBEE';

export interface PronunciationRule {
  id: string;
  term: string;
  spokenText: string;
  enabled: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  providerScope: ProviderScope;
  category: string | null;
  priority: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DictionaryConflictPolicy = 'skip' | 'replace';

export type DictionarySortBy = 'updatedAt' | 'term' | 'category' | 'priority';

export interface CreatePronunciationRuleInput {
  term: string;
  spokenText: string;
  enabled?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  providerScope?: ProviderScope;
  category?: string | null;
  priority?: number;
  note?: string | null;
}

export interface UpdatePronunciationRuleInput {
  term?: string;
  spokenText?: string;
  enabled?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  providerScope?: ProviderScope;
  category?: string | null;
  priority?: number;
  note?: string | null;
}

export interface DictionaryListOptionsInput {
  search?: string;
  category?: string;
  providerScope?: ProviderScope;
  enabled?: boolean;
  sortBy?: DictionarySortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface DictionaryImportInput {
  format: 'json' | 'csv';
  content: string;
  conflictPolicy: DictionaryConflictPolicy;
}

export interface DictionaryImportPreviewResult {
  total: number;
  newCount: number;
  conflictCount: number;
  invalidCount: number;
  conflicts: Array<{
    term: string;
    existingRule: PronunciationRule;
    incomingRule: CreatePronunciationRuleInput;
  }>;
  invalidRows: Array<{
    row: number;
    reason: string;
    data: unknown;
  }>;
}

export interface DictionaryExportInput {
  format: 'json' | 'csv';
  category?: string;
  providerScope?: ProviderScope;
}

export type DictionaryErrorCode =
  | 'RULE_NOT_FOUND'
  | 'RULE_INVALID'
  | 'RULE_ALREADY_EXISTS'
  | 'IMPORT_INVALID'
  | 'IMPORT_CONFLICT'
  | 'EXPORT_FAILED'
  | 'DICTIONARY_DATABASE_ERROR';
