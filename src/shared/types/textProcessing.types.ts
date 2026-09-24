import type { ProviderScope } from './dictionary.types';

export const TEXT_PROCESSOR_VERSION = 1;

export type TransformationStage =
  | 'dictionary'
  | 'date'
  | 'number'
  | 'currency'
  | 'abbreviation'
  | 'whitespace';

export interface TextTransformation {
  stage: TransformationStage;
  sourceText: string;
  resultText: string;
  sourceStart: number;
  sourceEnd: number;
  ruleId?: string;
  category?: string;
}

export interface TextProcessingWarning {
  code: string;
  message: string;
  position?: number;
  text?: string;
}

export interface TextProcessingStats {
  dictionaryMatches: number;
  datesNormalized: number;
  numbersNormalized: number;
  currenciesNormalized: number;
  abbreviationsNormalized: number;
  totalTransformations: number;
  durationMs?: number;
}

export interface TextProcessingSettings {
  dictionaryEnabled: boolean;
  whitespaceNormalization: boolean;
  dateNormalization: boolean;
  numberNormalization: boolean;
  currencyNormalization: boolean;
  abbreviationNormalization: boolean;
  providerContext: ProviderScope;
  processedFromRevision?: number;
  processedWithDictionaryRevision?: number;
  processedAt?: string;
  processorVersion?: number;
  processingFingerprint?: string;
}

export interface TextProcessingRequest {
  projectId?: string;
  text: string;
  settings: TextProcessingSettings;
}

export interface TextProcessingResult {
  originalText: string;
  processedText: string;
  dictionaryRevision: number;
  transformations: TextTransformation[];
  stats: TextProcessingStats;
  warnings: TextProcessingWarning[];
  fingerprint: string;
  processorVersion: number;
}
