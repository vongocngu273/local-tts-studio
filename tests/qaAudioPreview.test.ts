import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { appPathsService } from '../src/main/services/app-paths/appPaths.service';
import { audioStorageService } from '../src/main/services/audio/audioStorage.service';
import { generationRepository } from '../src/main/database/repositories/generation.repository';
import {
  createAudioStreamResponse,
  setupAudioProtocolHandler
} from '../src/main/services/audio/audioProtocol';
import type { TTSGeneration } from '../src/shared/types/provider.types';

let capturedHandler: ((request: Request) => Promise<Response>) | null = null;

vi.mock('electron', () => {
  return {
    protocol: {
      handle: vi.fn((scheme: string, handler: (request: Request) => Promise<Response>) => {
        if (scheme === 'localtts-audio') {
          capturedHandler = handler;
        }
      }),
      registerSchemesAsPrivileged: vi.fn()
    }
  };
});

describe('QA Audio Preview & Protocol Streaming Test Suite (TC-20260924-AUDIO-PREVIEW-FIX)', () => {
  let tempWorkspaceDir: string;
  let externalTempDir: string;
  let workspaceAudioDir: string;
  let testMp3Path: string;
  let testWavPath: string;
  let externalAudioPath: string;

  const testFileSize = 512;
  let testFileContent: Buffer;

  beforeEach(() => {
    // 1. Setup workspace inside temp
    tempWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-qa-workspace-'));
    externalTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-qa-external-'));

    appPathsService.initialize(tempWorkspaceDir);

    workspaceAudioDir = path.join(tempWorkspaceDir, 'cache', 'previews');
    fs.mkdirSync(workspaceAudioDir, { recursive: true });

    testMp3Path = path.join(workspaceAudioDir, 'sample_preview.mp3');
    testWavPath = path.join(workspaceAudioDir, 'sample_preview.wav');
    externalAudioPath = path.join(externalTempDir, 'forbidden_system.mp3');

    // 2. Create deterministic binary buffer [0, 1, 2, ..., 255, 0, 1, ...]
    testFileContent = Buffer.alloc(testFileSize);
    for (let i = 0; i < testFileSize; i++) {
      testFileContent[i] = i % 256;
    }

    fs.writeFileSync(testMp3Path, testFileContent);
    fs.writeFileSync(testWavPath, testFileContent);
    fs.writeFileSync(externalAudioPath, testFileContent);

    // 3. Register protocol handler and capture callback
    setupAudioProtocolHandler();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    capturedHandler = null;

    if (fs.existsSync(tempWorkspaceDir)) {
      fs.rmSync(tempWorkspaceDir, { recursive: true, force: true });
    }
    if (fs.existsSync(externalTempDir)) {
      fs.rmSync(externalTempDir, { recursive: true, force: true });
    }
  });

  // --------------------------------------------------------------------------
  // 1. HTTP Range Partial Audio Responses (Status 206)
  // --------------------------------------------------------------------------
  describe('HTTP Range Partial Audio Streaming (Status 206)', () => {
    it('serves partial range (bytes=0-99) with status 206 and correct headers for MP3', async () => {
      const response = await createAudioStreamResponse(testMp3Path, 'bytes=0-99');

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe(`bytes 0-99/${testFileSize}`);
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
      expect(response.headers.get('Content-Length')).toBe('100');
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');

      const arrayBuffer = await response.arrayBuffer();
      const body = Buffer.from(arrayBuffer);
      expect(body.length).toBe(100);
      expect(body).toEqual(testFileContent.subarray(0, 100));
    });

    it('serves open-ended range (bytes=200-) with status 206 for WAV', async () => {
      const response = await createAudioStreamResponse(testWavPath, 'bytes=200-');

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe(`bytes 200-${testFileSize - 1}/${testFileSize}`);
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
      expect(response.headers.get('Content-Length')).toBe(String(testFileSize - 200));
      expect(response.headers.get('Content-Type')).toBe('audio/wav');

      const arrayBuffer = await response.arrayBuffer();
      const body = Buffer.from(arrayBuffer);
      expect(body.length).toBe(testFileSize - 200);
      expect(body).toEqual(testFileContent.subarray(200));
    });

    it('serves suffix range (bytes=-50) with status 206', async () => {
      const response = await createAudioStreamResponse(testMp3Path, 'bytes=-50');

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe(`bytes ${testFileSize - 50}-${testFileSize - 1}/${testFileSize}`);
      expect(response.headers.get('Content-Length')).toBe('50');
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');

      const arrayBuffer = await response.arrayBuffer();
      const body = Buffer.from(arrayBuffer);
      expect(body.length).toBe(50);
      expect(body).toEqual(testFileContent.subarray(testFileSize - 50));
    });
  });

  // --------------------------------------------------------------------------
  // 2. Full Audio Response (Status 200)
  // --------------------------------------------------------------------------
  describe('Full Audio Response (Status 200)', () => {
    it('serves full audio response with status 200 and Content-Length when Range header is absent', async () => {
      const response = await createAudioStreamResponse(testMp3Path, null);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe(String(testFileSize));
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');

      const arrayBuffer = await response.arrayBuffer();
      const body = Buffer.from(arrayBuffer);
      expect(body.length).toBe(testFileSize);
      expect(body).toEqual(testFileContent);
    });

    it('serves full WAV audio response with status 200 and audio/wav MIME type', async () => {
      const response = await createAudioStreamResponse(testWavPath, null);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe(String(testFileSize));
      expect(response.headers.get('Content-Type')).toBe('audio/wav');
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Security: Path Traversal & Workspace Confinement (Status 403)
  // --------------------------------------------------------------------------
  describe('Security & Path Traversal Blocking (Status 403)', () => {
    it('blocks access to audio files outside application workspace with status 403', async () => {
      expect(capturedHandler).not.toBeNull();

      // Request file located in external directory
      const requestUrl = `localtts-audio://file?path=${encodeURIComponent(externalAudioPath)}`;
      const request = new Request(requestUrl);

      const response = await capturedHandler!(request);

      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).toContain('Access denied');
      expect(text).toContain('outside workspace');
    });

    it('blocks directory traversal attempts (../) attempting to escape workspace', async () => {
      expect(capturedHandler).not.toBeNull();

      const traversalPath = path.join(tempWorkspaceDir, '..', path.basename(externalTempDir), 'forbidden_system.mp3');
      const requestUrl = `localtts-audio://file?path=${encodeURIComponent(traversalPath)}`;
      const request = new Request(requestUrl);

      const response = await capturedHandler!(request);

      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).toContain('Access denied');
    });

    it('blocks generation playback when outputPath points outside workspace', async () => {
      expect(capturedHandler).not.toBeNull();

      const rogueGenId = 'rogue-gen-999';
      const mockRogueGen: Partial<TTSGeneration> = {
        id: rogueGenId,
        outputPath: externalAudioPath
      };

      vi.spyOn(generationRepository, 'getById').mockReturnValue(mockRogueGen as TTSGeneration);

      const requestUrl = `localtts-audio://generation/${rogueGenId}`;
      const request = new Request(requestUrl);

      const response = await capturedHandler!(request);

      expect(response.status).toBe(403);
      const text = await response.text();
      expect(text).toContain('Access denied');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Missing Files Handling (Status 404)
  // --------------------------------------------------------------------------
  describe('Missing Audio File Handling (Status 404)', () => {
    it('returns status 404 when requested generation does not exist', async () => {
      expect(capturedHandler).not.toBeNull();

      vi.spyOn(generationRepository, 'getById').mockReturnValue(null);

      const requestUrl = 'localtts-audio://generation/non-existent-gen-id';
      const request = new Request(requestUrl);

      const response = await capturedHandler!(request);

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toContain('Audio file not found');
    });

    it('returns status 404 when requested preview hash does not exist', async () => {
      expect(capturedHandler).not.toBeNull();

      const requestUrl = 'localtts-audio://preview/deadbeef_missing_hash';
      const request = new Request(requestUrl);

      const response = await capturedHandler!(request);

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toContain('Audio file not found');
    });

    it('returns status 404 when file parameter points to non-existent path', async () => {
      expect(capturedHandler).not.toBeNull();

      const missingFile = path.join(tempWorkspaceDir, 'cache', 'previews', 'ghost_audio.mp3');
      const requestUrl = `localtts-audio://file?path=${encodeURIComponent(missingFile)}`;
      const request = new Request(requestUrl);

      const response = await capturedHandler!(request);

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toContain('Audio file not found');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Valid Protocol Request Handling via `localtts-audio://`
  // --------------------------------------------------------------------------
  describe('Valid Protocol Request Handling', () => {
    it('streams audio file via localtts-audio://file route with Range support', async () => {
      expect(capturedHandler).not.toBeNull();

      const requestUrl = `localtts-audio://file?path=${encodeURIComponent(testMp3Path)}`;
      const request = new Request(requestUrl, {
        headers: { range: 'bytes=0-127' }
      });

      const response = await capturedHandler!(request);

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe(`bytes 0-127/${testFileSize}`);
      expect(response.headers.get('Content-Length')).toBe('128');
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    });

    it('streams generation audio via localtts-audio://generation route', async () => {
      expect(capturedHandler).not.toBeNull();

      const genId = 'gen-valid-123';
      const mockGen: Partial<TTSGeneration> = {
        id: genId,
        outputPath: testMp3Path
      };

      vi.spyOn(generationRepository, 'getById').mockReturnValue(mockGen as TTSGeneration);

      const requestUrl = `localtts-audio://generation/${genId}`;
      const request = new Request(requestUrl);

      const response = await capturedHandler!(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe(String(testFileSize));
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
    });

    it('streams preview audio via localtts-audio://preview route', async () => {
      expect(capturedHandler).not.toBeNull();

      const cacheKey = 'preview_valid_hash';
      vi.spyOn(audioStorageService, 'getPreviewAudioPath').mockReturnValue(testWavPath);

      const requestUrl = `localtts-audio://preview/${cacheKey}`;
      const request = new Request(requestUrl, {
        headers: { range: 'bytes=0-63' }
      });

      const response = await capturedHandler!(request);

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe(`bytes 0-63/${testFileSize}`);
      expect(response.headers.get('Content-Type')).toBe('audio/wav');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Frontend Component Verification (No JSX src props on <audio>)
  // --------------------------------------------------------------------------
  describe('Frontend Audio Element Collision Prevention', () => {
    it('verifies VoicesPage.tsx has no JSX src attribute on <audio> element', () => {
      const voicesPagePath = path.resolve(__dirname, '../src/renderer/pages/VoicesPage.tsx');
      expect(fs.existsSync(voicesPagePath)).toBe(true);

      const content = fs.readFileSync(voicesPagePath, 'utf-8');

      // 1. Locate <audio ... /> element
      const audioTagMatch = content.match(/<audio[\s\S]*?\/>/g);
      expect(audioTagMatch).not.toBeNull();
      expect(audioTagMatch!.length).toBeGreaterThanOrEqual(1);

      for (const tag of audioTagMatch!) {
        // Assert NO src attribute in JSX element
        expect(tag).not.toMatch(/\bsrc\s*=/);
        // Assert ref is used for imperative control
        expect(tag).toContain('ref={audioRef}');
        expect(tag).toContain('onEnded=');
        expect(tag).toContain('onError=');
      }

      // 2. Assert imperative audio handling with AbortError and NotAllowedError guards
      expect(content).toContain('audio.src = url');
      expect(content).toContain('audio.load()');
      expect(content).toContain('audio.play()');
      expect(content).toContain("'AbortError'");
      expect(content).toContain("'NotAllowedError'");
    });

    it('verifies TextToSpeechPage.tsx has no JSX src attribute on preview <audio> element', () => {
      const ttsPagePath = path.resolve(__dirname, '../src/renderer/pages/TextToSpeechPage.tsx');
      expect(fs.existsSync(ttsPagePath)).toBe(true);

      const content = fs.readFileSync(ttsPagePath, 'utf-8');

      // 1. Locate preview audio tag
      const audioTagMatch = content.match(/<audio[\s\S]*?\/>/g);
      expect(audioTagMatch).not.toBeNull();

      for (const tag of audioTagMatch!) {
        // Assert NO src attribute in JSX element
        expect(tag).not.toMatch(/\bsrc\s*=/);
        expect(tag).toContain('ref={previewAudioRef}');
        expect(tag).toContain('onEnded=');
        expect(tag).toContain('onError=');
      }

      // 2. Assert imperative audio playback handling
      expect(content).toContain('audio.src = url');
      expect(content).toContain('audio.load()');
      expect(content).toContain('audio.play()');
    });
  });
});
