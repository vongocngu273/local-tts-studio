import fs from 'fs';
import path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class LoggerService {
  private logFilePath: string | null = null;
  private initialized = false;

  public initialize(logDir: string): void {
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      this.logFilePath = path.join(logDir, 'app.log');
      this.initialized = true;
      this.info('logger', 'Logger initialized successfully');
    } catch (error) {
      console.error('Failed to initialize logger file sink:', error);
    }
  }

  public log(level: LogLevel, module: string, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = this.sanitize(message);
    const metaString = meta ? ` ${this.sanitize(JSON.stringify(meta))}` : '';
    const formattedLine = `[${timestamp}] [${level}] [${module}] ${sanitizedMessage}${metaString}\n`;

    // Console output for dev debugging
    if (level === 'ERROR') {
      console.error(formattedLine.trimEnd());
    } else if (level === 'WARN') {
      console.warn(formattedLine.trimEnd());
    } else {
      console.log(formattedLine.trimEnd());
    }

    // Persist to local app.log file
    if (this.initialized && this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, formattedLine, 'utf8');
      } catch (err) {
        console.error('Error writing to app.log:', err);
      }
    }
  }

  public debug(module: string, message: string, meta?: unknown): void {
    this.log('DEBUG', module, message, meta);
  }

  public info(module: string, message: string, meta?: unknown): void {
    this.log('INFO', module, message, meta);
  }

  public warn(module: string, message: string, meta?: unknown): void {
    this.log('WARN', module, message, meta);
  }

  public error(module: string, message: string, meta?: unknown): void {
    this.log('ERROR', module, message, meta);
  }

  /**
   * Sanitizes sensitive information like tokens, keys, passwords
   */
  private sanitize(input: string): string {
    return input
      .replace(/(bearer\s+[a-zA-Z0-9._-]+)/gi, 'bearer [REDACTED]')
      .replace(/(key[=:]\s*["']?)[a-zA-Z0-9_-]{8,}(["']?)/gi, '$1[REDACTED]$2')
      .replace(/(password[=:]\s*["']?)[^"'\s]+(["']?)/gi, '$1[REDACTED]$2');
  }
}

export const logger = new LoggerService();
