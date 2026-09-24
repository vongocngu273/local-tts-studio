import crypto from 'crypto';
import { pronunciationDictionaryRepository } from '../../database/repositories/pronunciationDictionary.repository';
import { appMetadataRepository } from '../../database/repositories/appMetadata.repository';
import { projectRepository } from '../../database/repositories/project.repository';
import { projectFilesystemService } from '../project-filesystem/projectFilesystem.service';
import { dictionaryMatcher } from './matcher/dictionaryMatcher';
import { whitespaceNormalizer } from './normalizers/whitespaceNormalizer';
import { dateNormalizer } from './normalizers/dateNormalizer';
import { currencyNormalizer } from './normalizers/currencyNormalizer';
import { vietnameseNumberNormalizer } from './normalizers/vietnameseNumberNormalizer';
import { abbreviationNormalizer } from './normalizers/abbreviationNormalizer';
import {
  TEXT_PROCESSOR_VERSION,
  type TextProcessingRequest,
  type TextProcessingResult,
  type TextProcessingSettings,
  type TextTransformation,
  type TextProcessingWarning
} from '@shared/types/textProcessing.types';
import type { MatcherSpan } from './matcher/dictionaryMatcher';
import { logger } from '../logger/logger';

export class TextProcessingService {
  /**
   * Executes the complete pure/deterministic Text Processing Pipeline (Section 24, 75).
   * Original text is never mutated!
   */
  public processText(request: TextProcessingRequest): TextProcessingResult {
    return this.process(request);
  }

  public process(request: TextProcessingRequest): TextProcessingResult {
    const startTime = Date.now();
    const originalText = request.text;
    const settings = request.settings;
    const dictionaryRevision = appMetadataRepository.getDictionaryRevision();

    let currentText = originalText;
    let protectedSpans: MatcherSpan[] = [];
    const allTransformations: TextTransformation[] = [];
    const allWarnings: TextProcessingWarning[] = [];

    // 1. Safe Whitespace Normalization (Conservative, default true)
    if (settings.whitespaceNormalization) {
      const wsResult = whitespaceNormalizer.normalize(currentText);
      currentText = wsResult.text;
      allTransformations.push(...wsResult.transformations);
    }

    // 2. User Pronunciation Dictionary (Highest Authority, Section 25)
    let dictionaryMatchesCount = 0;
    if (settings.dictionaryEnabled) {
      const activeRules = pronunciationDictionaryRepository.findApplicableRules(settings.providerContext);
      const dictResult = dictionaryMatcher.matchAndReplace(
        currentText,
        activeRules,
        settings.providerContext
      );
      currentText = dictResult.text;
      protectedSpans = dictResult.protectedSpans;
      allTransformations.push(...dictResult.transformations);
      dictionaryMatchesCount = dictResult.matchCount;
    }

    // 3. Date Normalization (Opt-in, Section 32)
    let datesNormalizedCount = 0;
    if (settings.dateNormalization) {
      const dateResult = dateNormalizer.normalize(currentText, protectedSpans);
      currentText = dateResult.text;
      protectedSpans = dateResult.protectedSpans;
      allTransformations.push(...dateResult.transformations);
      allWarnings.push(...dateResult.warnings);
      datesNormalizedCount = dateResult.transformations.length;
    }

    // 4. Currency Normalization (Opt-in, Section 36)
    let currenciesNormalizedCount = 0;
    if (settings.currencyNormalization) {
      const currResult = currencyNormalizer.normalize(currentText, protectedSpans);
      currentText = currResult.text;
      protectedSpans = currResult.protectedSpans;
      allTransformations.push(...currResult.transformations);
      currenciesNormalizedCount = currResult.transformations.length;
    }

    // 5. Number Normalization (Opt-in, Section 34)
    let numbersNormalizedCount = 0;
    if (settings.numberNormalization) {
      const numResult = vietnameseNumberNormalizer.normalize(currentText, protectedSpans);
      currentText = numResult.text;
      protectedSpans = numResult.protectedSpans;
      allTransformations.push(...numResult.transformations);
      numbersNormalizedCount = numResult.transformations.length;
    }

    // 6. Abbreviation Normalization (Opt-in, Section 37)
    let abbreviationsNormalizedCount = 0;
    if (settings.abbreviationNormalization) {
      const abbrResult = abbreviationNormalizer.normalize(currentText, protectedSpans);
      currentText = abbrResult.text;
      allTransformations.push(...abbrResult.transformations);
      abbreviationsNormalizedCount = abbrResult.transformations.length;
    }

    const durationMs = Date.now() - startTime;

    // 7. Deterministic Processing Fingerprint (Section 71)
    const fingerprintPayload = [
      originalText,
      dictionaryRevision,
      settings.dictionaryEnabled,
      settings.whitespaceNormalization,
      settings.dateNormalization,
      settings.numberNormalization,
      settings.currencyNormalization,
      settings.abbreviationNormalization,
      settings.providerContext,
      TEXT_PROCESSOR_VERSION
    ].join(':');

    const fingerprint = crypto.createHash('sha256').update(fingerprintPayload).digest('hex');

    return {
      originalText,
      processedText: currentText,
      dictionaryRevision,
      transformations: allTransformations,
      stats: {
        dictionaryMatches: dictionaryMatchesCount,
        datesNormalized: datesNormalizedCount,
        numbersNormalized: numbersNormalizedCount,
        currenciesNormalized: currenciesNormalizedCount,
        abbreviationsNormalized: abbreviationsNormalizedCount,
        totalTransformations: allTransformations.length,
        durationMs
      },
      warnings: allWarnings,
      fingerprint,
      processorVersion: TEXT_PROCESSOR_VERSION
    };
  }

  /**
   * Processes a project script, updates SQLite and writes script-processed.txt atomically (Section 73, 104, 106).
   */
  public async processProject(
    projectId: string,
    settingsOverride?: Partial<TextProcessingSettings>
  ): Promise<TextProcessingResult> {
    const project = projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const currentSettings: TextProcessingSettings = {
      dictionaryEnabled: true,
      whitespaceNormalization: true,
      dateNormalization: false,
      numberNormalization: false,
      currencyNormalization: false,
      abbreviationNormalization: false,
      providerContext: 'ALL',
      ...project.settings.textProcessing,
      ...settingsOverride
    };

    logger.info('text-processing', `Starting processing for project ${projectId} (${project.originalText.length} chars)`);

    const result = this.process({
      projectId,
      text: project.originalText,
      settings: currentSettings
    });

    const now = new Date().toISOString();
    const updatedSettings: TextProcessingSettings = {
      ...currentSettings,
      processedFromRevision: project.revision,
      processedWithDictionaryRevision: result.dictionaryRevision,
      processedAt: now,
      processorVersion: result.processorVersion,
      processingFingerprint: result.fingerprint
    };

    // 1. Update SQLite without bumping original text revision (Section 74)
    const newProjectSettings = {
      ...project.settings,
      textProcessing: updatedSettings
    };
    projectRepository.saveProcessedText(projectId, result.processedText, newProjectSettings);

    // 2. Atomic write script-processed.txt (Section 104, 106)
    projectFilesystemService.writeScriptProcessed(project.projectPath, result.processedText);

    // 3. Update project.json metadata snapshot
    const updatedProject = projectRepository.findById(projectId)!;
    projectFilesystemService.writeProjectMetadataSnapshot(project.projectPath, updatedProject);

    logger.info(
      'text-processing',
      `Completed processing project ${projectId}: ${result.stats.totalTransformations} transformations in ${result.stats.durationMs}ms`
    );

    return result;
  }
}

export const textProcessingService = new TextProcessingService();
