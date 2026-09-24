import type { ProviderId } from '@shared/types/provider.types';

export class TTSProviderError extends Error {
  public readonly providerId: ProviderId;
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    providerId: ProviderId,
    code: string,
    message: string,
    options?: { statusCode?: number; retryable?: boolean; cause?: unknown }
  ) {
    super(`[${providerId}] ${message}`);
    this.name = 'TTSProviderError';
    this.providerId = providerId;
    this.code = code;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

export class TTSAuthenticationError extends TTSProviderError {
  constructor(providerId: ProviderId, message = 'Authentication failed. Please check your API key.') {
    super(providerId, 'AUTH_FAILED', message, { statusCode: 401, retryable: false });
    this.name = 'TTSAuthenticationError';
  }
}

export class TTSRateLimitError extends TTSProviderError {
  constructor(providerId: ProviderId, message = 'Provider rate limit or quota exceeded.') {
    super(providerId, 'RATE_LIMIT', message, { statusCode: 429, retryable: true });
    this.name = 'TTSRateLimitError';
  }
}

export class TTSNetworkError extends TTSProviderError {
  constructor(providerId: ProviderId, message: string, cause?: unknown) {
    super(providerId, 'NETWORK_ERROR', message, { retryable: true, cause });
    this.name = 'TTSNetworkError';
  }
}

export class TTSInvalidVoiceError extends TTSProviderError {
  constructor(providerId: ProviderId, voiceId: string) {
    super(providerId, 'INVALID_VOICE', `Voice "${voiceId}" is not valid or supported by ${providerId}.`, {
      statusCode: 400,
      retryable: false
    });
    this.name = 'TTSInvalidVoiceError';
  }
}

export class TTSTimeoutError extends TTSProviderError {
  constructor(providerId: ProviderId, timeoutMs: number) {
    super(providerId, 'TIMEOUT', `Synthesis request timed out after ${timeoutMs}ms.`, {
      statusCode: 408,
      retryable: true
    });
    this.name = 'TTSTimeoutError';
  }
}

export class TTSContentLengthError extends TTSProviderError {
  constructor(providerId: ProviderId, currentLength: number, maxLength: number) {
    super(
      providerId,
      'CONTENT_TOO_LONG',
      `Script length (${currentLength} chars) exceeds maximum supported limit (${maxLength} chars) for ${providerId}.`,
      { statusCode: 413, retryable: false }
    );
    this.name = 'TTSContentLengthError';
  }
}
