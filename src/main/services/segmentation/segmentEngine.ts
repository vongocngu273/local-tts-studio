import crypto from 'crypto';
import type {
  ProjectSegment,
  SegmentationProfile,
  BuildSegmentsResult
} from '@shared/types/segment.types';
import { DEFAULT_SEGMENTATION_PROFILE } from '@shared/types/segment.types';
import type { ProviderId, VoiceSettings } from '@shared/types/provider.types';
import type { Project } from '@shared/types/project.types';
import { paragraphSplitter } from './paragraphSplitter';
import { sentenceSplitter } from './sentenceSplitter';
import { segmentOptimizer } from './segmentOptimizer';
import { computeSegmentFingerprint } from './segmentFingerprint';
import { segmentRepository } from '../../database/repositories/segment.repository';
import { projectRepository } from '../../database/repositories/project.repository';
import { appMetadataRepository } from '../../database/repositories/appMetadata.repository';
import { logger } from '../logger/logger';

export interface BuildSegmentsOptions {
  projectId: string;
  providerId?: ProviderId;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: VoiceSettings;
  profile?: Partial<SegmentationProfile>;
}

export class SegmentEngine {
  /**
   * Builds or rebuilds project segments from authoritative processed_text.
   * Enforces strict stale validation and audio reuse for matching fingerprints.
   */
  public async buildSegments(options: BuildSegmentsOptions): Promise<BuildSegmentsResult> {
    const { projectId } = options;
    const project = projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const processedText = project.processedText?.trim();
    if (!processedText) {
      throw new Error('NO_PROCESSED_TEXT: Project has no processed script. Please run text processing before building segments.');
    }

    // Strict Stale Validation
    this.assertNotStale(project);

    const providerId = options.providerId || project.providerId || 'edge-tts';
    const voiceId = options.voiceId || project.voiceId || 'vi-VN-HoaiMyNeural';
    const modelId = options.modelId || null;
    const voiceSettings: VoiceSettings = options.voiceSettings || project.settings?.voice || {};
    const profile = options.profile || project.settings?.segmentation || DEFAULT_SEGMENTATION_PROFILE;

    const processingFingerprint = project.settings?.textProcessing?.processingFingerprint || 'v1';

    // 1. Split into paragraphs
    const paragraphs = paragraphSplitter.split(processedText);

    // 2. Split each paragraph into sentences
    const allSentences = paragraphs.flatMap((para) => sentenceSplitter.splitParagraph(para));

    // 3. Optimize sentences into bounded segments
    const finalProfile: SegmentationProfile = { ...DEFAULT_SEGMENTATION_PROFILE, ...profile };
    const optimizedSegments = segmentOptimizer.optimize(allSentences, finalProfile);

    logger.info(
      'segment:engine',
      `Splitted ${processedText.length} characters into ${paragraphs.length} paragraphs and ${optimizedSegments.length} segments`
    );

    // 4. Retrieve existing completed segments to check for audio reuse
    const existingSegments = segmentRepository.listByProject(projectId);
    const reusableMap = new Map<string, ProjectSegment>();
    for (const seg of existingSegments) {
      if (seg.status === 'completed' && seg.audioPath) {
        reusableMap.set(seg.textHash, seg);
      }
    }

    const now = new Date().toISOString();
    const newSegments: ProjectSegment[] = [];
    let reusedCount = 0;
    let freshCount = 0;

    for (let index = 0; index < optimizedSegments.length; index++) {
      const opt = optimizedSegments[index];
      const segmentId = crypto.randomUUID();

      const textHash = computeSegmentFingerprint({
        text: opt.text,
        providerId,
        voiceId,
        modelId,
        settings: voiceSettings,
        processingFingerprint
      });

      // Check if matching completed segment exists for audio reuse
      const matched = reusableMap.get(textHash);
      if (matched) {
        reusedCount++;
        newSegments.push({
          id: segmentId,
          projectId,
          segmentIndex: index,
          text: opt.text,
          textHash,
          baseText: opt.text,
          overrideText: null,
          hasOverride: false,
          sourceStart: opt.sourceStart,
          sourceEnd: opt.sourceEnd,
          paragraphIndex: opt.paragraphIndex,
          status: 'completed', // REUSED
          providerId,
          voiceId,
          modelId,
          settings: voiceSettings,
          generationId: matched.generationId,
          audioPath: matched.audioPath,
          timingPath: matched.timingPath,
          durationMs: matched.durationMs,
          characterCount: opt.characterCount,
          pauseAfterMs: null,
          errorCode: null,
          errorMessage: null,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          completedAt: matched.completedAt
        });
      } else {
        freshCount++;
        newSegments.push({
          id: segmentId,
          projectId,
          segmentIndex: index,
          text: opt.text,
          textHash,
          baseText: opt.text,
          overrideText: null,
          hasOverride: false,
          sourceStart: opt.sourceStart,
          sourceEnd: opt.sourceEnd,
          paragraphIndex: opt.paragraphIndex,
          status: 'pending',
          providerId,
          voiceId,
          modelId,
          settings: voiceSettings,
          generationId: null,
          audioPath: null,
          timingPath: null,
          durationMs: null,
          characterCount: opt.characterCount,
          pauseAfterMs: null,
          errorCode: null,
          errorMessage: null,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          completedAt: null
        });
      }
    }

    // 5. Replace project segments in database atomically
    segmentRepository.deleteByProject(projectId);
    segmentRepository.insertBatch(newSegments);

    logger.info(
      'segment:engine',
      `Saved ${newSegments.length} segments for project ${projectId} (${reusedCount} reused, ${freshCount} new pending)`
    );

    return {
      segments: newSegments,
      totalSegments: newSegments.length,
      reusedSegments: reusedCount,
      newSegments: freshCount
    };
  }

  /**
   * Asserts that processed text is not stale compared to script revision or dictionary revision.
   */
  private assertNotStale(project: Project): void {
    const currentDictRev = appMetadataRepository.getDictionaryRevision();
    const procMeta = project.settings?.textProcessing;

    const isStale =
      !procMeta ||
      procMeta.processedFromRevision === undefined ||
      project.revision > procMeta.processedFromRevision ||
      (procMeta.processedWithDictionaryRevision !== undefined &&
        currentDictRev > procMeta.processedWithDictionaryRevision);

    if (isStale) {
      throw new Error(
        'SCRIPT_STALE: The processed script is stale because the original text or pronunciation dictionary has changed. Please reprocess the script before building segments.'
      );
    }
  }
}

export const segmentEngine = new SegmentEngine();
