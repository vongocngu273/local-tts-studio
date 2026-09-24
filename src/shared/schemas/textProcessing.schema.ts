import { z } from 'zod';
import { ProviderScopeSchema } from './dictionary.schema';

export const TextProcessingSettingsSchema = z.object({
  dictionaryEnabled: z.boolean().default(true),
  whitespaceNormalization: z.boolean().default(true),
  dateNormalization: z.boolean().default(false),
  numberNormalization: z.boolean().default(false),
  currencyNormalization: z.boolean().default(false),
  abbreviationNormalization: z.boolean().default(false),
  providerContext: ProviderScopeSchema.default('ALL'),
  processedFromRevision: z.number().int().positive().optional(),
  processedWithDictionaryRevision: z.number().int().nonnegative().optional(),
  processedAt: z.string().datetime().optional(),
  processorVersion: z.number().int().positive().optional(),
  processingFingerprint: z.string().optional()
});

export const TextProcessingRequestSchema = z.object({
  projectId: z.string().uuid().optional(),
  text: z.string(),
  settings: TextProcessingSettingsSchema
});

export const TransformationStageSchema = z.enum([
  'dictionary',
  'date',
  'number',
  'currency',
  'abbreviation',
  'whitespace'
]);

export const TextTransformationSchema = z.object({
  stage: TransformationStageSchema,
  sourceText: z.string(),
  resultText: z.string(),
  sourceStart: z.number().int().nonnegative(),
  sourceEnd: z.number().int().nonnegative(),
  ruleId: z.string().optional(),
  category: z.string().optional()
});

export const TextProcessingStatsSchema = z.object({
  dictionaryMatches: z.number().int().nonnegative(),
  datesNormalized: z.number().int().nonnegative(),
  numbersNormalized: z.number().int().nonnegative(),
  currenciesNormalized: z.number().int().nonnegative(),
  abbreviationsNormalized: z.number().int().nonnegative(),
  totalTransformations: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative().optional()
});

export const TextProcessingWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  position: z.number().int().nonnegative().optional(),
  text: z.string().optional()
});

export const TextProcessingResultSchema = z.object({
  originalText: z.string(),
  processedText: z.string(),
  dictionaryRevision: z.number().int().nonnegative(),
  transformations: z.array(TextTransformationSchema),
  stats: TextProcessingStatsSchema,
  warnings: z.array(TextProcessingWarningSchema),
  fingerprint: z.string(),
  processorVersion: z.number().int().positive()
});
