/**
 * Retry - Exponential backoff retry utility for AI handlers
 *
 * Provides configurable retry logic with exponential backoff for
 * transient failures in data loading and API calls.
 *
 * Usage:
 * ```typescript
 * import { retry, retryWithFallback } from '@/lib/ai/utilities/retry';
 *
 * // Basic retry
 * const data = await retry(() => fetchData(), { maxAttempts: 3 });
 *
 * // With fallback
 * const data = await retryWithFallback(
 *   () => fetchFromPrimary(),
 *   () => fetchFromCache(),
 *   { maxAttempts: 2 }
 * );
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;

  /** Maximum delay in ms between retries (default: 10000) */
  maxDelayMs?: number;

  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;

  /** Add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;

  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;

  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Operation name for logging */
  operationName?: string;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'signal' | 'operationName'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  isRetryable: () => true,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * multiplier^attempt
  let delay = initialDelay * Math.pow(multiplier, attempt);

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);

  // Add jitter (0-25% of delay)
  if (jitter) {
    const jitterAmount = delay * 0.25 * Math.random();
    delay += jitterAmount;
  }

  return Math.round(delay);
}

/**
 * Sleep for specified milliseconds with abort support
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Operation aborted'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Operation aborted'));
      }, { once: true });
    }
  });
}

/**
 * Check if an error is a network error (retryable)
 */
export function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econnrefused') ||
    message.includes('timeout') ||
    message.includes('503') ||
    message.includes('504')
  );
}

/**
 * Check if an error is a rate limit error (retryable with longer delay)
 */
export function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('rate') || message.includes('limit') || message.includes('429');
}

// ============================================================================
// Main Retry Function
// ============================================================================

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - The async operation to retry
 * @param options - Retry configuration options
 * @returns The result of the operation or throws on failure
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      // Check for abort
      if (opts.signal?.aborted) {
        throw new Error('Operation aborted');
      }

      // Execute operation
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const isLastAttempt = attempt === opts.maxAttempts - 1;
      const shouldRetry = !isLastAttempt && opts.isRetryable(error);

      if (!shouldRetry) {
        throw lastError;
      }

      // Calculate delay
      const delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier,
        opts.jitter
      );

      // Notify retry callback
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, error, delay);
      }

      // Log retry
      if (opts.operationName) {
        console.warn(
          `[Retry] ${opts.operationName} failed (attempt ${attempt + 1}/${opts.maxAttempts}), ` +
          `retrying in ${delay}ms: ${lastError.message}`
        );
      }

      // Wait before retry
      await sleep(delay, opts.signal);
    }
  }

  // This shouldn't be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed');
}

/**
 * Retry with detailed result (doesn't throw)
 */
export async function retryWithResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const data = await retry(operation, {
      ...options,
      onRetry: (attempt, error, delay) => {
        attempts = attempt;
        options.onRetry?.(attempt, error, delay);
      },
    });

    return {
      success: true,
      data,
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Retry with a fallback operation if all retries fail
 */
export async function retryWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  try {
    return await retry(primary, options);
  } catch (primaryError) {
    if (options.operationName) {
      console.warn(
        `[Retry] ${options.operationName} exhausted retries, trying fallback`
      );
    }

    try {
      return await fallback();
    } catch (fallbackError) {
      // Throw a combined error
      const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`Primary failed: ${primaryMsg}; Fallback failed: ${fallbackMsg}`);
    }
  }
}

// ============================================================================
// Specialized Retry Functions
// ============================================================================

/**
 * Retry specifically for data loading operations
 * Uses shorter delays and fewer attempts
 */
export async function retryDataLoad<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  return retry(operation, {
    maxAttempts: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    operationName,
    isRetryable: isNetworkError,
  });
}

/**
 * Retry for API calls with rate limit awareness
 * Uses longer delays and more attempts
 */
export async function retryApiCall<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  return retry(operation, {
    maxAttempts: 4,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    operationName,
    isRetryable: (error) => isNetworkError(error) || isRateLimitError(error),
  });
}

/**
 * Retry once (simple retry for quick operations)
 */
export async function retryOnce<T>(
  operation: () => Promise<T>
): Promise<T> {
  return retry(operation, {
    maxAttempts: 2,
    initialDelayMs: 100,
    jitter: false,
  });
}

// ============================================================================
// Utility: Circuit Breaker Pattern
// ============================================================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Execute with circuit breaker pattern
 * Prevents repeated calls to a failing service
 */
export async function withCircuitBreaker<T>(
  key: string,
  operation: () => Promise<T>,
  options: {
    failureThreshold?: number;
    resetTimeMs?: number;
  } = {}
): Promise<T> {
  const { failureThreshold = 5, resetTimeMs = 60000 } = options;

  // Get or create circuit state
  let state = circuitBreakers.get(key);
  if (!state) {
    state = { failures: 0, lastFailure: 0, isOpen: false };
    circuitBreakers.set(key, state);
  }

  // Check if circuit is open
  if (state.isOpen) {
    const timeSinceFailure = Date.now() - state.lastFailure;
    if (timeSinceFailure < resetTimeMs) {
      throw new Error(`Circuit breaker open for ${key}. Try again in ${Math.ceil((resetTimeMs - timeSinceFailure) / 1000)}s`);
    }
    // Reset circuit (half-open state)
    state.isOpen = false;
    state.failures = 0;
  }

  try {
    const result = await operation();
    // Success resets failures
    state.failures = 0;
    return result;
  } catch (error) {
    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= failureThreshold) {
      state.isOpen = true;
      console.warn(`[CircuitBreaker] ${key} opened after ${state.failures} failures`);
    }

    throw error;
  }
}

/**
 * Reset a circuit breaker manually
 */
export function resetCircuitBreaker(key: string): void {
  circuitBreakers.delete(key);
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(key: string): CircuitBreakerState | null {
  return circuitBreakers.get(key) || null;
}
