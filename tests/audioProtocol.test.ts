import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getAudioMimeType,
  parseRangeHeader,
  createAudioStreamResponse
} from '../src/main/services/audio/audioProtocol';

describe('Audio Protocol Streaming & Range Support', () => {
  let tempDir: string;
  let testMp3Path: string;
  let testWavPath: string;
  const testFileSize = 256;
  let testFileContent: Buffer;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localtts-protocol-test-'));
    testMp3Path = path.join(tempDir, 'sample_audio.mp3');
    testWavPath = path.join(tempDir, 'sample_audio.wav');

    // Create 256-byte binary pattern [0, 1, 2, ..., 255]
    testFileContent = Buffer.alloc(testFileSize);
    for (let i = 0; i < testFileSize; i++) {
      testFileContent[i] = i % 256;
    }

    fs.writeFileSync(testMp3Path, testFileContent);
    fs.writeFileSync(testWavPath, testFileContent);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('getAudioMimeType', () => {
    it('returns audio/mpeg for MP3 files (case-insensitive)', () => {
      expect(getAudioMimeType('/path/to/voice.mp3')).toBe('audio/mpeg');
      expect(getAudioMimeType('preview.MP3')).toBe('audio/mpeg');
    });

    it('returns audio/wav for WAV files (case-insensitive)', () => {
      expect(getAudioMimeType('/path/to/audio.wav')).toBe('audio/wav');
      expect(getAudioMimeType('recording.WAV')).toBe('audio/wav');
    });

    it('defaults to audio/mpeg for other extensions', () => {
      expect(getAudioMimeType('unknown_audio.bin')).toBe('audio/mpeg');
    });
  });

  describe('parseRangeHeader', () => {
    const totalSize = 1000;

    it('parses open-ended range from start (bytes=0-)', () => {
      const range = parseRangeHeader('bytes=0-', totalSize);
      expect(range).toEqual({
        start: 0,
        end: 999,
        chunkSize: 1000
      });
    });

    it('parses specific range chunk (bytes=100-200)', () => {
      const range = parseRangeHeader('bytes=100-200', totalSize);
      expect(range).toEqual({
        start: 100,
        end: 200,
        chunkSize: 101
      });
    });

    it('parses mid-file open-ended range (bytes=500-)', () => {
      const range = parseRangeHeader('bytes=500-', totalSize);
      expect(range).toEqual({
        start: 500,
        end: 999,
        chunkSize: 500
      });
    });

    it('parses suffix byte range (bytes=-200)', () => {
      const range = parseRangeHeader('bytes=-200', totalSize);
      expect(range).toEqual({
        start: 800,
        end: 999,
        chunkSize: 200
      });
    });

    it('clamps end to totalSize - 1 when requested end exceeds file size', () => {
      const range = parseRangeHeader('bytes=900-5000', totalSize);
      expect(range).toEqual({
        start: 900,
        end: 999,
        chunkSize: 100
      });
    });

    it('returns null for missing, non-bytes, or invalid range headers', () => {
      expect(parseRangeHeader(null, totalSize)).toBeNull();
      expect(parseRangeHeader(undefined, totalSize)).toBeNull();
      expect(parseRangeHeader('', totalSize)).toBeNull();
      expect(parseRangeHeader('items=0-100', totalSize)).toBeNull();
      expect(parseRangeHeader('bytes=abc-def', totalSize)).toBeNull();
      expect(parseRangeHeader('bytes=1500-2000', totalSize)).toBeNull(); // start >= totalSize
      expect(parseRangeHeader('bytes=500-100', totalSize)).toBeNull(); // end < start
    });
  });

  describe('createAudioStreamResponse', () => {
    it('serves full 200 response with Accept-Ranges when Range header is not provided', async () => {
      const response = await createAudioStreamResponse(testMp3Path, null);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe(String(testFileSize));
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');

      const arrayBuffer = await response.arrayBuffer();
      const receivedBuffer = Buffer.from(arrayBuffer);
      expect(receivedBuffer).toEqual(testFileContent);
    });

    it('serves partial 206 response with Content-Range for byte range request', async () => {
      const start = 10;
      const end = 49; // 40 bytes
      const rangeHeader = `bytes=${start}-${end}`;

      const response = await createAudioStreamResponse(testMp3Path, rangeHeader);

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe(`bytes ${start}-${end}/${testFileSize}`);
      expect(response.headers.get('Content-Length')).toBe('40');
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');

      const arrayBuffer = await response.arrayBuffer();
      const receivedBuffer = Buffer.from(arrayBuffer);
      expect(receivedBuffer.length).toBe(40);
      expect(receivedBuffer).toEqual(testFileContent.subarray(start, end + 1));
    });

    it('serves initial bytes probe (bytes=0-) with 206 Partial Content for Chromium audio element', async () => {
      const response = await createAudioStreamResponse(testMp3Path, 'bytes=0-');

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Range')).toBe(`bytes 0-${testFileSize - 1}/${testFileSize}`);
      expect(response.headers.get('Content-Length')).toBe(String(testFileSize));
      expect(response.headers.get('Content-Type')).toBe('audio/mpeg');
      expect(response.headers.get('Accept-Ranges')).toBe('bytes');

      const arrayBuffer = await response.arrayBuffer();
      const receivedBuffer = Buffer.from(arrayBuffer);
      expect(receivedBuffer).toEqual(testFileContent);
    });

    it('serves correct audio/wav MIME type for WAV audio files', async () => {
      const response = await createAudioStreamResponse(testWavPath, 'bytes=0-9');

      expect(response.status).toBe(206);
      expect(response.headers.get('Content-Type')).toBe('audio/wav');
      expect(response.headers.get('Content-Range')).toBe(`bytes 0-9/${testFileSize}`);
      expect(response.headers.get('Content-Length')).toBe('10');
    });
  });
});
