import crypto from 'crypto';
import type { ProviderId, VoiceSettings } from '@shared/types/provider.types';

export interface FingerprintParams {
  text: string;
  providerId: ProviderId | null;
  voiceId: string | null;
  modelId: string | null;
  settings: VoiceSettings;
  processingFingerprint?: string;
}

export function computeSegmentFingerprint(params: FingerprintParams): string {
  const normalizedSettings: VoiceSettings = {
    speed: params.settings?.speed ?? 1.0,
    pitch: params.settings?.pitch ?? 0,
    volume: params.settings?.volume ?? 100,
    modelId: params.settings?.modelId || params.modelId || undefined,
    stability: params.settings?.stability,
    similarityBoost: params.settings?.similarityBoost,
    style: params.settings?.style,
    useSpeakerBoost: params.settings?.useSpeakerBoost
  };

  const payload = [
    params.text.trim(),
    params.providerId || 'edge-tts',
    params.voiceId || 'vi-VN-HoaiMyNeural',
    params.modelId || '',
    JSON.stringify(normalizedSettings),
    params.processingFingerprint || 'v1'
  ].join(':');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}
