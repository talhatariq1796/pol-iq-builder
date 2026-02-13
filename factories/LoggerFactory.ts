import { Logger } from '../utils/Logger';

export class LoggerFactory {
  static create(context: string): Logger {
    return {
      info: (message, meta) => console.log(`[${context}] INFO: ${message}`, meta),
      error: (message, meta) => console.error(`[${context}] ERROR: ${message}`, meta),
      warn: (message, meta) => console.warn(`[${context}] WARN: ${message}`, meta)
    };
  }
}