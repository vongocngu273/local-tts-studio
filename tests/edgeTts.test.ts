import { describe, it, expect } from 'vitest';
import {
  generateSecMsGec,
  formatRateProsody,
  formatPitchProsody,
  formatVolumeProsody,
  getEdgeFallbackVoices
} from '../src/main/providers/edge/edgeTtsClient';
import { edgeTtsAdapter } from '../src/main/providers/edge/edgeTts.adapter';

describe('Edge TTS Adapter & Client', () => {
  it('should generate valid 64-char uppercase SHA-256 Sec-MS-GEC token', () => {
    const token = generateSecMsGec();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(64);
    // Uppercase hex only
    expect(/^[0-9A-F]{64}$/.test(token)).toBe(true);
  });

  it('should format rate prosody correctly according to SSML standards', () => {
    expect(formatRateProsody(1.0)).toBe('+0%');
    expect(formatRateProsody(1.25)).toBe('+25%');
    expect(formatRateProsody(1.5)).toBe('+50%');
    expect(formatRateProsody(0.8)).toBe('-20%');
    expect(formatRateProsody(0.5)).toBe('-50%');
  });

  it('should format pitch prosody correctly with Hz units', () => {
    expect(formatPitchProsody(0)).toBe('+0Hz');
    expect(formatPitchProsody(10)).toBe('+10Hz');
    expect(formatPitchProsody(-15)).toBe('-15Hz');
  });

  it('should format volume prosody correctly', () => {
    expect(formatVolumeProsody(100)).toBe('+0%');
    expect(formatVolumeProsody(80)).toBe('-20%');
    expect(formatVolumeProsody(120)).toBe('+20%');
  });

  it('should provide curated Vietnamese and English fallback voices', () => {
    const voices = getEdgeFallbackVoices();
    expect(voices.length).toBeGreaterThanOrEqual(4);

    const hoaiMy = voices.find((v) => v.id === 'vi-VN-HoaiMyNeural');
    expect(hoaiMy).toBeDefined();
    expect(hoaiMy?.locale).toBe('vi-VN');
    expect(hoaiMy?.language).toBe('VI');
    expect(hoaiMy?.gender).toBe('female');

    const namMinh = voices.find((v) => v.id === 'vi-VN-NamMinhNeural');
    expect(namMinh).toBeDefined();
    expect(namMinh?.locale).toBe('vi-VN');
    expect(namMinh?.language).toBe('VI');
    expect(namMinh?.gender).toBe('male');
  });

  it('should configure edgeTtsAdapter with offline/free capabilities and no API key', () => {
    expect(edgeTtsAdapter.id).toBe('edge-tts');
    expect(edgeTtsAdapter.capabilities.supportsPitch).toBe(true);
    expect(edgeTtsAdapter.capabilities.supportsRate).toBe(true);
    expect(edgeTtsAdapter.isConfigured()).toBe(true);
  });
});
