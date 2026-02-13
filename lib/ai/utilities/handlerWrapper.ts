/**
 * Handler Wrapper - Standardized error handling and loading state for AI handlers
 *
 * Provides a wrapper function that handles:
 * - Error recovery with user-friendly messages
 * - Loading state tracking via ApplicationStateManager
 * - Retry logic for transient failures
 * - Consistent HandlerResult format
 *
 * Usage:
 * ```typescript
 * import { wrapHandler } from '@/lib/ai/utilities/handlerWrapper';
 *
 * export const handleDonorQuery = wrapHandler(
 *   'donor_query',
 *   async (params) => {
 *     // ... handler logic
 *     return { response, mapCommands, suggestedActions };
 *   }
 * );
 * ```
 */

import type { SuggestedAction } from '@/lib/ai-native/types';
import type { QueryIntent, HandlerResult } from '@/lib/ai-native/handlers/types';
import { ErrorRecovery, type ErrorCategory } from './errorRecovery';
import { retryWithResult, type RetryOptions } from './retry';

// Import StateManager dynamically to avoid circular dependencies
let stateManagerModule: typeof import('@/lib/ai-native/ApplicationStateManager') | null = null;

async function getStateManager() {
  if (!stateManagerModule) {
    stateManagerModule = await import('@/lib/ai-native/ApplicationStateManager');
  }
  return stateManagerModule.getStateManager();
}

// ============================================================================
// Types
// ============================================================================

export interface WrapperOptions {
  /** Operation name for logging and loading state */
  operationName: string;

  /** Query intent for recovery suggestions */
  intent?: QueryIntent;

  /** Whether to track loading state (default: true) */
  trackLoading?: boolean;

  /** Retry options for transient failures */
  retryOptions?: Partial<RetryOptions>;

  /** Whether to retry on failure (default: false for most handlers) */
  enableRetry?: boolean;
}

export interface HandlerContext {
  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Additional metadata to include in result */
  metadata?: Record<string, unknown>;
}

// Define MapCommand locally to avoid circular import
interface MapCommand {
  type: string;
  [key: string]: unknown;
}

export interface WrappedHandlerResult {
  response: string;
  mapCommands?: MapCommand[];
  suggestedActions?: SuggestedAction[];
  data?: unknown;
  success?: boolean;
  error?: string;
}

// ============================================================================
// Handler Wrapper
// ============================================================================

/**
 * Wrap a handler function with standardized error handling
 *
 * @param options - Wrapper configuration
 * @param handler - The handler function to wrap
 * @returns Wrapped handler with error handling
 */
export function wrapHandler<TParams, TResult extends WrappedHandlerResult>(
  options: WrapperOptions,
  handler: (params: TParams, context?: HandlerContext) => Promise<TResult>
): (params: TParams, context?: HandlerContext) => Promise<HandlerResult> {
  const {
    operationName,
    intent,
    trackLoading = true,
    retryOptions,
    enableRetry = false,
  } = options;

  return async (params: TParams, context?: HandlerContext): Promise<HandlerResult> => {
    const operationId = `${operationName}-${Date.now()}`;

    try {
      // Track loading state if enabled
      if (trackLoading) {
        try {
          const stateManager = await getStateManager();
          stateManager.startLoading(operationId, operationName);
        } catch {
          // Continue without loading tracking if state manager unavailable
        }
      }

      // Execute handler with optional retry
      let result: TResult;
      if (enableRetry) {
        const retryResult = await retryWithResult(
          () => handler(params, context),
          {
            maxAttempts: 2,
            initialDelayMs: 500,
            operationName,
            ...retryOptions,
          }
        );

        if (!retryResult.success || !retryResult.data) {
          throw retryResult.error || new Error('Handler failed after retries');
        }
        result = retryResult.data;
      } else {
        result = await handler(params, context);
      }

      // Mark loading as successful
      if (trackLoading) {
        try {
          const stateManager = await getStateManager();
          stateManager.loadingSuccess(operationId);
        } catch {
          // Continue without loading tracking
        }
      }

      // Return standardized result
      return {
        success: result.success !== false,
        response: result.response,
        mapCommands: result.mapCommands as HandlerResult['mapCommands'],
        suggestedActions: result.suggestedActions,
        data: result.data,
        metadata: {
          handlerName: operationName,
          processingTimeMs: 0, // Could be calculated if needed
          queryType: operationName,
          matchedIntent: intent || 'unknown',
          confidence: 1,
          ...context?.metadata,
        },
      };
    } catch (error) {
      // Track error
      if (trackLoading) {
        try {
          const stateManager = await getStateManager();
          const errorMsg = error instanceof Error ? error.message : String(error);
          stateManager.loadingError(operationId, errorMsg);
        } catch {
          // Continue without loading tracking
        }
      }

      // Generate recovery suggestions
      const recovery = ErrorRecovery.generateRecovery(error, intent);

      console.error(`[${operationName}] Handler error:`, error);

      return {
        success: false,
        response: recovery.userMessage,
        suggestedActions: recovery.suggestedActions,
        error: recovery.technicalMessage,
        metadata: {
          handlerName: operationName,
          processingTimeMs: 0,
          queryType: operationName,
          matchedIntent: intent || 'unknown',
          confidence: 0,
          errorCategory: recovery.category,
          isRecoverable: recovery.isRecoverable,
        },
      };
    }
  };
}

/**
 * Create a simple error result for quick handler failures
 */
export function createErrorResult(
  error: unknown,
  intent?: QueryIntent,
  operationName?: string
): HandlerResult {
  const recovery = ErrorRecovery.generateRecovery(error, intent);

  return {
    success: false,
    response: recovery.userMessage,
    suggestedActions: recovery.suggestedActions,
    error: recovery.technicalMessage,
    metadata: {
      handlerName: operationName || 'unknown',
      processingTimeMs: 0,
      queryType: operationName || 'unknown',
      matchedIntent: intent || 'unknown',
      confidence: 0,
    },
  };
}

/**
 * Create a success result with standard format
 */
export function createSuccessResult(
  response: string,
  options?: {
    mapCommands?: MapCommand[];
    suggestedActions?: SuggestedAction[];
    data?: unknown;
    operationName?: string;
    intent?: QueryIntent;
  }
): HandlerResult {
  return {
    success: true,
    response,
    mapCommands: options?.mapCommands as HandlerResult['mapCommands'],
    suggestedActions: options?.suggestedActions,
    data: options?.data,
    metadata: {
      handlerName: options?.operationName || 'unknown',
      processingTimeMs: 0,
      queryType: options?.operationName || 'unknown',
      matchedIntent: options?.intent || 'unknown',
      confidence: 1,
    },
  };
}

/**
 * Helper to check if a fetch response is ok, throwing descriptive error if not
 */
export async function checkFetchResponse(
  response: Response,
  resourceName: string
): Promise<void> {
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`${resourceName} not found`);
    }
    if (response.status >= 500) {
      throw new Error(`Server error loading ${resourceName}`);
    }
    throw new Error(`Failed to load ${resourceName}: ${response.status}`);
  }
}

/**
 * Safe JSON parse with error context
 */
export async function safeJsonParse<T>(
  response: Response,
  resourceName: string
): Promise<T> {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse ${resourceName} data`);
  }
}
