import { ErrorConfig, ErrorDomain, ErrorMapping, defaultErrorConfig } from '@/config/errorConfig';

export type ErrorCategory = ErrorDomain;

export interface ErrorState {
  code: string;
  message: string;
  details?: string;
  recoverable: boolean;
  timestamp: number;
  category: ErrorCategory;
  retryCount: number;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffType: 'fixed' | 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorConfig: ErrorConfig;
  private errorCounts: Map<string, number> = new Map();
  private circuitBreakerState: Map<string, boolean> = new Map();

  private constructor(errorConfig: ErrorConfig) {
    this.errorConfig = errorConfig;
  }

  public static getInstance(errorConfig?: ErrorConfig): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(errorConfig || defaultErrorConfig);
    }
    return ErrorHandler.instance;
  }

  private getRetryConfig(category: ErrorCategory): RetryConfig {
    return this.errorConfig.retry.strategies[category];
  }

  private calculateBackoff(config: RetryConfig, attempt: number): number {
    let delay: number;
    
    switch (config.backoffType) {
      case 'fixed':
        delay = config.initialDelay;
        break;
      case 'linear':
        delay = config.initialDelay * attempt;
        break;
      case 'exponential':
        delay = config.initialDelay * Math.pow(2, attempt - 1);
        break;
      default:
        delay = config.initialDelay;
    }

    if (config.jitter) {
      delay = delay * (0.5 + Math.random());
    }

    return Math.min(delay, config.maxDelay);
  }

  public async withRetry<T>(
    operation: () => Promise<T>,
    category: ErrorCategory = 'external',
    context: string = 'unknown'
  ): Promise<T> {
    const config = this.getRetryConfig(category);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        if (this.isCircuitBreakerOpen(context)) {
          throw new Error(`Circuit breaker is open for ${context}`);
        }

        const result = await operation();
        this.resetErrorCount(context);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[${context}] Error in attempt ${attempt}/${config.maxAttempts}:`, lastError);

        if (attempt === config.maxAttempts) {
          this.incrementErrorCount(context);
          break;
        }

        const delay = this.calculateBackoff(config, attempt);
        console.log(`[${context}] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw this.createErrorState(lastError!, category, context);
  }

  private isCircuitBreakerOpen(context: string): boolean {
    const isOpen = this.circuitBreakerState.get(context);
    if (isOpen) {
      const errorCount = this.errorCounts.get(context) || 0;
      if (errorCount >= this.errorConfig.retry.circuitBreaker.failureThreshold) {
        return true;
      }
      this.circuitBreakerState.delete(context);
    }
    return false;
  }

  private incrementErrorCount(context: string): void {
    const count = (this.errorCounts.get(context) || 0) + 1;
    this.errorCounts.set(context, count);

    if (count >= this.errorConfig.retry.circuitBreaker.failureThreshold) {
      this.circuitBreakerState.set(context, true);
      setTimeout(() => {
        this.circuitBreakerState.delete(context);
        this.errorCounts.delete(context);
      }, this.errorConfig.retry.circuitBreaker.resetTimeout);
    }
  }

  private resetErrorCount(context: string): void {
    this.errorCounts.delete(context);
    this.circuitBreakerState.delete(context);
  }

  private createErrorState(error: Error, category: ErrorCategory, context: string): ErrorState {
    const errorMapping = this.errorConfig.errorMappings[category]?.find(
      (mapping: ErrorMapping) => error.message.includes(mapping.errorCode)
    );

    return {
      code: errorMapping?.errorCode || 'UNKNOWN_ERROR',
      message: errorMapping?.response.message || error.message,
      details: error.stack,
      recoverable: errorMapping?.response.fallbackBehavior === 'retry',
      timestamp: Date.now(),
      category,
      retryCount: this.errorCounts.get(context) || 0
    };
  }
} 