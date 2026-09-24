import { TTSProviderError, TTSAuthenticationError } from '../../providers/provider.errors';

export class RetryPolicy {
  public static readonly DEFAULT_MAX_ATTEMPTS = 3;

  /**
   * Determines if an error can be retried.
   */
  public static isRetryable(err: unknown): boolean {
    if (err instanceof TTSAuthenticationError) {
      return false;
    }

    if (err instanceof TTSProviderError) {
      if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 400 || err.statusCode === 404) {
        return false;
      }
      if (err.code === 'NO_PROCESSED_TEXT' || err.code === 'SCRIPT_STALE' || err.code === 'INVALID_VOICE') {
        return false;
      }
      if (err.statusCode === 429 || (err.statusCode && err.statusCode >= 500)) {
        return true;
      }
      return err.retryable;
    }

    const message = err instanceof Error ? err.message : String(err);
    if (/401|403|unauthorized|forbidden|invalid api key|invalid voice/i.test(message)) {
      return false;
    }

    // Network / timeout / rate limit errors are retryable
    if (/timeout|econnreset|etimedout|enotfound|rate limit|429|502|503|504/i.test(message)) {
      return true;
    }

    return true;
  }

  /**
   * Calculates exponential backoff with jitter in milliseconds.
   */
  public static calculateBackoffMs(attempt: number, retryAfterSeconds?: number): number {
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }

    // Attempt 1: ~2s, Attempt 2: ~4-5s, Attempt 3: ~8-10s (capped at 30s)
    const base = Math.pow(2, attempt) * 1000;
    const jitter = Math.floor(Math.random() * 500);
    return Math.min(30000, base + jitter);
  }
}
