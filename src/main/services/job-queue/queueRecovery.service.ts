import { jobRepository } from '../../database/repositories/job.repository';
import { logger } from '../logger/logger';

export class QueueRecoveryService {
  /**
   * Recovers jobs left in 'running' state from previous crashed/interrupted sessions.
   */
  public recoverInterruptedJobs(): number {
    const interruptedCount = jobRepository.recoverInterruptedJobs();
    if (interruptedCount > 0) {
      logger.warn(
        'queue:recovery',
        `Recovered ${interruptedCount} orphaned job(s) from previous session (marked as interrupted)`
      );
    }
    return interruptedCount;
  }
}

export const queueRecoveryService = new QueueRecoveryService();
