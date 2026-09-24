import { z } from 'zod';

export const ProviderScopeSchema = z.enum([
  'ALL',
  'EDGE',
  'LUCYLAB',
  'ELEVENLABS',
  'VBEE'
]);

export const PronunciationRuleSchema = z.object({
  id: z.string().uuid(),
  term: z.string().trim().min(1, 'Term is required').max(250, 'Term cannot exceed 250 characters'),
  spokenText: z.string().trim().min(1, 'Spoken text is required').max(1000, 'Spoken text cannot exceed 1000 characters'),
  enabled: z.boolean().default(true),
  caseSensitive: z.boolean().default(false),
  wholeWord: z.boolean().default(true),
  providerScope: ProviderScopeSchema.default('ALL'),
  category: z.string().trim().max(50).nullable().optional().default(null),
  priority: z.number().int().min(-100).max(100).default(0),
  note: z.string().trim().max(1000).nullable().optional().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const CreatePronunciationRuleSchema = z.object({
  term: z.string().trim().min(1, 'Term is required').max(250, 'Term cannot exceed 250 characters'),
  spokenText: z.string().trim().min(1, 'Spoken text is required').max(1000, 'Spoken text cannot exceed 1000 characters'),
  enabled: z.boolean().optional().default(true),
  caseSensitive: z.boolean().optional().default(false),
  wholeWord: z.boolean().optional().default(true),
  providerScope: ProviderScopeSchema.optional().default('ALL'),
  category: z.string().trim().max(50).nullable().optional().default(null),
  priority: z.number().int().min(-100).max(100).optional().default(0),
  note: z.string().trim().max(1000).nullable().optional().default(null)
});

export const UpdatePronunciationRuleSchema = z.object({
  term: z.string().trim().min(1, 'Term cannot be empty').max(250).optional(),
  spokenText: z.string().trim().min(1, 'Spoken text cannot be empty').max(1000).optional(),
  enabled: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  wholeWord: z.boolean().optional(),
  providerScope: ProviderScopeSchema.optional(),
  category: z.string().trim().max(50).nullable().optional(),
  priority: z.number().int().min(-100).max(100).optional(),
  note: z.string().trim().max(1000).nullable().optional()
});

export const DictionaryListOptionsSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  providerScope: ProviderScopeSchema.optional(),
  enabled: z.boolean().optional(),
  sortBy: z.enum(['updatedAt', 'term', 'category', 'priority']).optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.number().int().positive().max(5000).optional(),
  offset: z.number().int().nonnegative().optional()
});

export const DictionaryImportSchema = z.object({
  format: z.enum(['json', 'csv']),
  content: z.string().min(1, 'Content cannot be empty'),
  conflictPolicy: z.enum(['skip', 'replace']).default('skip')
});

export const DictionaryExportSchema = z.object({
  format: z.enum(['json', 'csv']),
  category: z.string().optional(),
  providerScope: ProviderScopeSchema.optional()
});
