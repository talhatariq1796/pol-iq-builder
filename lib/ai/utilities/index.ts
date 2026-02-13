/**
 * AI Utilities - Barrel Export
 *
 * Centralized utilities for AI handlers including error recovery,
 * retry logic, and circuit breaker patterns.
 */

// Error Recovery
export {
  ErrorRecovery,
  type ErrorCategory,
  type RecoveryResult,
} from './errorRecovery';

// Retry Utilities
export {
  retry,
  retryWithResult,
  retryWithFallback,
  retryDataLoad,
  retryApiCall,
  retryOnce,
  isNetworkError,
  isRateLimitError,
  withCircuitBreaker,
  resetCircuitBreaker,
  getCircuitBreakerStatus,
  type RetryOptions,
  type RetryResult,
} from './retry';

// Handler Wrapper
export {
  wrapHandler,
  createErrorResult,
  createSuccessResult,
  checkFetchResponse,
  safeJsonParse,
  type WrapperOptions,
  type HandlerContext,
  type WrappedHandlerResult,
} from './handlerWrapper';
