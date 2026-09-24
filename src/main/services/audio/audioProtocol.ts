import fs from 'fs';
import { Readable } from 'stream';
import { protocol } from 'electron';
import { audioStorageService } from './audioStorage.service';
import { generationRepository } from '../../database/repositories/generation.repository';
import { logger } from '../logger/logger';

export const AUDIO_PROTOCOL_SCHEME = 'localtts-audio';

/**
 * Returns appropriate audio MIME type based on file extension.
 */
export function getAudioMimeType(filePath: string): string {
  return filePath.toLowerCase().endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
}

/**
 * Parses HTTP Range header string into start, end, and chunkSize.
 */
export function parseRangeHeader(
  rangeHeader: string | null | undefined,
  totalSize: number
): { start: number; end: number; chunkSize: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const rawStart = parts[0]?.trim();
  const rawEnd = parts[1]?.trim();

  let start = 0;
  let end = totalSize - 1;

  if (rawStart && rawEnd) {
    start = parseInt(rawStart, 10);
    end = parseInt(rawEnd, 10);
  } else if (rawStart) {
    start = parseInt(rawStart, 10);
    end = totalSize - 1;
  } else if (rawEnd) {
    start = totalSize - parseInt(rawEnd, 10);
    end = totalSize - 1;
  }

  if (isNaN(start) || isNaN(end) || start < 0 || start >= totalSize || end < start) {
    return null;
  }

  end = Math.min(end, totalSize - 1);
  const chunkSize = end - start + 1;

  return { start, end, chunkSize };
}

/**
 * Creates a streaming audio Response supporting HTTP Range (206) and full (200).
 */
export async function createAudioStreamResponse(
  filePath: string,
  rangeHeader: string | null
): Promise<Response> {
  const stat = await fs.promises.stat(filePath);
  const mimeType = getAudioMimeType(filePath);

  if (rangeHeader) {
    const range = parseRangeHeader(rangeHeader, stat.size);
    if (range) {
      const stream = fs.createReadStream(filePath, { start: range.start, end: range.end });
      logger.info(
        'audio:protocol',
        `Streaming partial audio [${range.start}-${range.end}/${stat.size}] for ${filePath}`
      );
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(range.chunkSize),
          'Content-Type': mimeType
        }
      });
    }
  }

  logger.info('audio:protocol', `Streaming full audio (${stat.size} bytes) for ${filePath}`);
  return new Response(Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      'Content-Length': String(stat.size),
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes'
    }
  });
}

/**
 * Must be invoked BEFORE app.whenReady() to register standard/secure scheme.
 */
export function registerAudioProtocolScheme(): void {
  try {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: AUDIO_PROTOCOL_SCHEME,
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          stream: true,
          corsEnabled: true,
          bypassCSP: true
        }
      }
    ]);
    logger.info('audio:protocol', `Registered privileged scheme: ${AUDIO_PROTOCOL_SCHEME}`);
  } catch (err) {
    logger.error('audio:protocol', `Failed to register scheme ${AUDIO_PROTOCOL_SCHEME}`, err);
  }
}

/**
 * Must be invoked AFTER app.whenReady() to handle audio streaming requests.
 */
export function setupAudioProtocolHandler(): void {
  protocol.handle(AUDIO_PROTOCOL_SCHEME, async (request) => {
    try {
      const parsedUrl = new URL(request.url);
      const host = parsedUrl.host; // e.g. "generation" or "preview"
      const resourceId = parsedUrl.pathname.replace(/^\/+/, ''); // e.g. generation UUID or hash

      let filePath: string | null = null;

      if (host === 'generation') {
        const generation = generationRepository.getById(resourceId);
        if (generation && generation.outputPath) {
          filePath = generation.outputPath;
        }
      } else if (host === 'preview') {
        filePath = audioStorageService.getPreviewAudioPath(resourceId);
      } else if (host === 'file') {
        const rawPath = parsedUrl.searchParams.get('path') || decodeURIComponent(resourceId);
        if (rawPath) {
          filePath = rawPath;
        }
      }

      if (!filePath || !fs.existsSync(filePath)) {
        logger.warn('audio:protocol', `Audio file not found: ${request.url}`);
        return new Response('Audio file not found', { status: 404 });
      }

      // Security check: Target file must be strictly within application workspace
      if (!audioStorageService.isPathWithinWorkspace(filePath)) {
        logger.error('audio:protocol', `Blocked forbidden audio access outside workspace: ${filePath}`);
        return new Response('Access denied: Path outside workspace', { status: 403 });
      }

      const rangeHeader = request.headers.get('range');
      return await createAudioStreamResponse(filePath, rangeHeader);
    } catch (err) {
      logger.error('audio:protocol', `Error serving audio protocol request: ${request.url}`, err);
      return new Response('Internal Audio Protocol Error', { status: 500 });
    }
  });

  logger.info('audio:protocol', `Setup ${AUDIO_PROTOCOL_SCHEME} protocol handler`);
}
