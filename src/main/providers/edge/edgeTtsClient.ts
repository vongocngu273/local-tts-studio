import crypto from 'crypto';
import WebSocket from 'ws';
import type { VoiceDefinition, VoiceGender } from '@shared/types/provider.types';
import { TTSNetworkError, TTSTimeoutError, TTSProviderError } from '../provider.errors';
import { logger } from '../../services/logger/logger';

const WIN_EPOCH = 11644473600;
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const BASE_URL = 'speech.platform.bing.com/consumer/speech/synthesize/readaloud';

export interface EdgeWordBoundary {
  type: string;
  offset: number;
  duration: number;
  text: string;
}

export interface EdgeSynthesisOptions {
  text: string;
  voice: string;
  speed?: number; // 0.5 to 2.0 (default 1.0)
  pitch?: number; // -50 to +50 Hz (default 0)
  volume?: number; // 0 to 100 (default 100)
  timeoutMs?: number;
}

export interface EdgeSynthesisResult {
  audioBuffer: Buffer;
  format: string;
  mimeType: string;
  boundaries: EdgeWordBoundary[];
}

/**
 * Generates Microsoft's anti-abuse Sec-MS-GEC token based on Windows epoch ticks and SHA-256.
 */
export function generateSecMsGec(): string {
  let ticks = Math.floor(Date.now() / 1000) + WIN_EPOCH;
  ticks -= ticks % 300;
  const ticks100ns = BigInt(ticks) * 10000000n;
  const strToHash = `${ticks100ns}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

/**
 * Returns formatted date string matching Microsoft Edge Read Aloud client headers.
 */
function getEdgeTimestampString(): string {
  const d = new Date();
  return d.toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
}

/**
 * XML entity escaping.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats rate prosody (e.g. 1.25 -> "+25%", 0.8 -> "-20%", 1.0 -> "+0%").
 */
export function formatRateProsody(speed = 1.0): string {
  const pct = Math.round((speed - 1.0) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/**
 * Formats pitch prosody (e.g. 10 -> "+10Hz", -5 -> "-5Hz", 0 -> "+0Hz").
 */
export function formatPitchProsody(pitch = 0): string {
  return pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;
}

/**
 * Formats volume prosody (e.g. 100 -> "+0%", 80 -> "-20%").
 */
export function formatVolumeProsody(volume = 100): string {
  const diff = Math.round(volume - 100);
  return diff >= 0 ? `+${diff}%` : `${diff}%`;
}

export class EdgeTtsClient {
  /**
   * Synthesizes audio using Microsoft Edge TTS WebSocket.
   */
  public async synthesize(options: EdgeSynthesisOptions): Promise<EdgeSynthesisResult> {
    const {
      text,
      voice,
      speed = 1.0,
      pitch = 0,
      volume = 100,
      timeoutMs
    } = options;

    const connectionId = crypto.randomUUID().replace(/-/g, '');
    const requestId = crypto.randomUUID().replace(/-/g, '');
    const secMsGec = generateSecMsGec();

    const wssUrl = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`;

    return new Promise<EdgeSynthesisResult>((resolve, reject) => {
      let isDone = false;
      const audioChunks: Buffer[] = [];
      const boundaries: EdgeWordBoundary[] = [];

      let ws: WebSocket;
      try {
        ws = new WebSocket(wssUrl, {
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache',
            'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0`
          }
        });
      } catch (err) {
        return reject(new TTSNetworkError('edge-tts', 'Failed to initialize WebSocket client', err));
      }

      // Dynamic Two-tier Watchdog Architecture
      // 1. Initial Connection Watchdog: abort if handshake takes longer than 25s
      const connectTimeoutMs = 25000;
      let connectTimer: NodeJS.Timeout | null = setTimeout(() => {
        if (!isDone) {
          cleanup();
          reject(new TTSNetworkError('edge-tts', `Connection to Edge TTS timed out after ${connectTimeoutMs}ms`));
        }
      }, connectTimeoutMs);

      // 2. Rolling Inactivity Watchdog: reset every time an audio chunk or metadata packet arrives
      const inactivityTimeoutMs = 30000;
      let inactivityTimer: NodeJS.Timeout | null = null;
      const resetInactivityTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          if (!isDone) {
            cleanup();
            reject(new TTSTimeoutError('edge-tts', inactivityTimeoutMs));
          }
        }, inactivityTimeoutMs);
      };

      // 3. Adaptive Maximum Overall Safeguard based on text length
      const maxOverallTimeoutMs = timeoutMs ?? Math.max(120000, 30000 + Math.ceil(text.length * 200));
      const maxOverallTimer = setTimeout(() => {
        if (!isDone) {
          cleanup();
          reject(new TTSTimeoutError('edge-tts', maxOverallTimeoutMs));
        }
      }, maxOverallTimeoutMs);

      const cleanup = () => {
        isDone = true;
        if (connectTimer) clearTimeout(connectTimer);
        if (inactivityTimer) clearTimeout(inactivityTimer);
        clearTimeout(maxOverallTimer);
        try {
          ws.close();
        } catch {
          // ignore
        }
      };

      ws.on('open', () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
        resetInactivityTimer();

        const timestamp = getEdgeTimestampString();

        // 1. Send speech.config
        const configMessage =
          `X-Timestamp:${timestamp}\r\n` +
          'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: 'false',
                    wordBoundaryEnabled: 'true'
                  },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
                }
              }
            }
          });

        ws.send(configMessage, (err) => {
          if (err) logger.warn('edge-tts', 'Error sending config message', err);
        });

        // 2. Build SSML
        const rateStr = formatRateProsody(speed);
        const pitchStr = formatPitchProsody(pitch);
        const volumeStr = formatVolumeProsody(volume);
        const escapedText = escapeXml(text);

        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='${pitchStr}' rate='${rateStr}' volume='${volumeStr}'>` +
          `${escapedText}` +
          `</prosody>` +
          `</voice>` +
          `</speak>`;

        // 3. Send SSML request
        const ssmlMessage =
          `X-RequestId:${requestId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          `X-Timestamp:${timestamp}Z\r\n` +
          'Path:ssml\r\n\r\n' +
          ssml;

        ws.send(ssmlMessage, (err) => {
          if (err) logger.warn('edge-tts', 'Error sending SSML message', err);
        });
      });

      ws.on('message', (data: WebSocket.Data, isBinary: boolean) => {
        resetInactivityTimer();
        if (!isBinary) {
          const str = data.toString('utf-8');
          if (str.includes('Path:turn.end')) {
            cleanup();
            if (audioChunks.length === 0) {
              return reject(new TTSProviderError('edge-tts', 'EMPTY_AUDIO', 'No audio bytes received from Edge TTS'));
            }
            const completeAudio = Buffer.concat(audioChunks);
            return resolve({
              audioBuffer: completeAudio,
              format: 'mp3',
              mimeType: 'audio/mpeg',
              boundaries
            });
          } else if (str.includes('Path:audio.metadata')) {
            try {
              const bodyIndex = str.indexOf('\r\n\r\n');
              if (bodyIndex !== -1) {
                const jsonBody = JSON.parse(str.slice(bodyIndex + 4));
                if (Array.isArray(jsonBody.Metadata)) {
                  for (const meta of jsonBody.Metadata) {
                    if (meta.Type === 'WordBoundary') {
                      boundaries.push({
                        type: 'WordBoundary',
                        offset: meta.Data.Offset,
                        duration: meta.Data.Duration,
                        text: meta.Data.text?.Text || ''
                      });
                    }
                  }
                }
              }
            } catch {
              // Non-critical metadata parse error
            }
          }
        } else {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
          if (buffer.length > 2) {
            const headerLength = buffer.readUInt16BE(0);
            if (buffer.length >= 2 + headerLength) {
              const headerStr = buffer.subarray(2, 2 + headerLength).toString('utf-8');
              if (headerStr.includes('Path:audio')) {
                const audioData = buffer.subarray(2 + headerLength);
                if (audioData.length > 0) {
                  audioChunks.push(audioData);
                }
              }
            }
          }
        }
      });

      ws.on('error', (err: Error) => {
        cleanup();
        logger.error('edge-tts', 'WebSocket error during synthesis', err);
        reject(new TTSNetworkError('edge-tts', 'Edge TTS connection encountered an error', err));
      });

      ws.on('close', (code: number, reason: Buffer) => {
        if (!isDone) {
          cleanup();
          if (audioChunks.length > 0) {
            const completeAudio = Buffer.concat(audioChunks);
            return resolve({
              audioBuffer: completeAudio,
              format: 'mp3',
              mimeType: 'audio/mpeg',
              boundaries
            });
          }
          reject(new TTSNetworkError('edge-tts', `WebSocket closed prematurely with code ${code}: ${reason.toString()}`));
        }
      });
    });
  }

  /**
   * Fetches the live Microsoft voice catalog with fallback to offline catalog.
   */
  public async fetchVoices(): Promise<VoiceDefinition[]> {
    const secMsGec = generateSecMsGec();
    const url = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });

      if (response.ok) {
        const rawVoices = (await response.json()) as Array<{
          ShortName: string;
          FriendlyName: string;
          Locale: string;
          Gender: string;
          SuggestedCodec?: string;
        }>;

        if (Array.isArray(rawVoices) && rawVoices.length > 0) {
          return rawVoices.map((v) => {
            const gender: VoiceGender =
              v.Gender?.toLowerCase() === 'female'
                ? 'female'
                : v.Gender?.toLowerCase() === 'male'
                  ? 'male'
                  : 'neutral';

            const language = v.Locale?.split('-')[0]?.toUpperCase() || 'UNKNOWN';

            return {
              id: v.ShortName,
              providerId: 'edge-tts',
              name: v.FriendlyName || v.ShortName,
              locale: v.Locale,
              language,
              gender,
              description: `Microsoft Edge ${v.Locale} ${gender} voice`,
              sampleRate: 24000,
              metadata: {
                shortName: v.ShortName,
                codec: v.SuggestedCodec || 'audio-24khz-48kbitrate-mono-mp3'
              }
            };
          });
        }
      }
    } catch (err) {
      logger.warn('edge-tts', 'Failed to fetch live voices list from Microsoft; using curated fallback', err);
    }

    return getEdgeFallbackVoices();
  }
}

export function getEdgeFallbackVoices(): VoiceDefinition[] {
  return [
    {
      id: 'vi-VN-HoaiMyNeural',
      providerId: 'edge-tts',
      name: 'Microsoft Hoài My (Nữ, Tiếng Việt)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'female',
      description: 'Giọng đọc nữ tiếng Việt tự nhiên và truyền cảm',
      sampleRate: 24000,
      metadata: { shortName: 'vi-VN-HoaiMyNeural' }
    },
    {
      id: 'vi-VN-NamMinhNeural',
      providerId: 'edge-tts',
      name: 'Microsoft Nam Minh (Nam, Tiếng Việt)',
      locale: 'vi-VN',
      language: 'VI',
      gender: 'male',
      description: 'Giọng đọc nam tiếng Việt ấm áp, rõ ràng',
      sampleRate: 24000,
      metadata: { shortName: 'vi-VN-NamMinhNeural' }
    },
    {
      id: 'en-US-JennyNeural',
      providerId: 'edge-tts',
      name: 'Microsoft Jenny (Female, US English)',
      locale: 'en-US',
      language: 'EN',
      gender: 'female',
      description: 'Clear, professional American English female voice',
      sampleRate: 24000,
      metadata: { shortName: 'en-US-JennyNeural' }
    },
    {
      id: 'en-US-GuyNeural',
      providerId: 'edge-tts',
      name: 'Microsoft Guy (Male, US English)',
      locale: 'en-US',
      language: 'EN',
      gender: 'male',
      description: 'Friendly, natural American English male voice',
      sampleRate: 24000,
      metadata: { shortName: 'en-US-GuyNeural' }
    },
    {
      id: 'en-GB-SoniaNeural',
      providerId: 'edge-tts',
      name: 'Microsoft Sonia (Female, British English)',
      locale: 'en-GB',
      language: 'EN',
      gender: 'female',
      description: 'British English female narration voice',
      sampleRate: 24000,
      metadata: { shortName: 'en-GB-SoniaNeural' }
    }
  ];
}

export const edgeTtsClient = new EdgeTtsClient();
