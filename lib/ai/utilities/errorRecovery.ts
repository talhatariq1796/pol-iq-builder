/**
 * ErrorRecovery - Centralized error recovery suggestion generator
 *
 * Provides context-aware recovery suggestions when AI handlers encounter errors.
 * Part of Phase 1 prep work for fixing 72 audit issues.
 *
 * Usage:
 * ```typescript
 * import { ErrorRecovery, ErrorCategory } from '@/lib/ai/utilities/errorRecovery';
 *
 * try {
 *   // ... handler logic
 * } catch (error) {
 *   const recovery = ErrorRecovery.generateRecovery(error, 'donor_concentration');
 *   return {
 *     success: false,
 *     response: recovery.userMessage,
 *     suggestedActions: recovery.suggestedActions,
 *     error: recovery.technicalMessage
 *   };
 * }
 * ```
 */

import type { SuggestedAction } from '@/lib/ai-native/types';
import type { QueryIntent } from '@/lib/ai-native/handlers/types';

// ============================================================================
// Error Categories
// ============================================================================

export type ErrorCategory =
  | 'data_unavailable'      // Data file missing or failed to load
  | 'network_error'         // Network request failed
  | 'parsing_error'         // Failed to parse input or data
  | 'validation_error'      // Input validation failed
  | 'permission_error'      // Insufficient permissions
  | 'rate_limit'            // Rate limited by API
  | 'timeout'               // Operation timed out
  | 'entity_not_found'      // Requested entity doesn't exist
  | 'service_unavailable'   // Backend service down
  | 'unknown';              // Catch-all for unclassified errors

// ============================================================================
// Recovery Result Interface
// ============================================================================

export interface RecoveryResult {
  /** User-friendly error message */
  userMessage: string;

  /** Technical error message for logging */
  technicalMessage: string;

  /** Suggested actions for recovery */
  suggestedActions: SuggestedAction[];

  /** Error category for metrics/logging */
  category: ErrorCategory;

  /** Whether the error is recoverable */
  isRecoverable: boolean;

  /** Suggested retry delay in ms (if applicable) */
  retryDelayMs?: number;
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classify an error into a category based on error message and type
 */
function classifyError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Network errors
  if (message.includes('fetch') || message.includes('network') || message.includes('econnrefused')) {
    return 'network_error';
  }

  // Data availability
  if (message.includes('not found') || message.includes('404') || message.includes('missing')) {
    return 'data_unavailable';
  }

  // Entity not found (specific)
  if (message.includes('precinct') || message.includes('entity') || message.includes('no match')) {
    return 'entity_not_found';
  }

  // Parsing errors
  if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
    return 'parsing_error';
  }

  // Validation errors
  if (message.includes('invalid') || message.includes('required') || message.includes('validation')) {
    return 'validation_error';
  }

  // Rate limiting
  if (message.includes('rate') || message.includes('limit') || message.includes('429')) {
    return 'rate_limit';
  }

  // Timeout
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }

  // Service unavailable
  if (message.includes('unavailable') || message.includes('503') || message.includes('service')) {
    return 'service_unavailable';
  }

  // Permission
  if (message.includes('permission') || message.includes('unauthorized') || message.includes('403')) {
    return 'permission_error';
  }

  return 'unknown';
}

// ============================================================================
// Intent-Specific Recovery Messages
// ============================================================================

const INTENT_RECOVERY_MESSAGES: Partial<Record<QueryIntent, string>> = {
  // Segmentation
  segment_create: 'Try using different filter criteria or broadening your search.',
  segment_find: 'Check the precinct name spelling or try searching by district.',
  segment_save: 'Make sure you have an active segment to save.',
  segment_export: 'Ensure you have a saved segment before exporting.',

  // Canvassing
  canvass_create: 'Try selecting specific precincts or adjusting the door count.',
  canvass_plan: 'Ensure you have precincts selected for planning.',
  canvass_estimate: 'Provide the number of volunteers or doors for estimation.',
  canvass_export: 'Generate a canvass plan first before exporting.',

  // Donor
  donor_concentration: 'Try a different area or check if donor data is available.',
  donor_prospects: 'Adjust the prospect criteria or expand the search area.',
  donor_trends: 'Select a time period with available donor data.',
  donor_lapsed: 'Adjust the lapsed threshold or check data availability.',
  donor_upgrade: 'Set a minimum upgrade amount or expand the donor pool.',

  // Comparison
  compare_jurisdictions: 'Select two entities to compare.',
  compare_find_similar: 'Select a reference entity first.',
  compare_resource_analysis: 'Ensure both entities have resource data available.',
  compare_batch: 'Select at least two entities for batch comparison.',

  // Report
  report_generate: 'Select an area or precinct before generating a report.',
  report_preview: 'Load a report first to preview it.',
};

// ============================================================================
// Category-Specific Suggested Actions
// ============================================================================

function getRecoveryActions(category: ErrorCategory, intent?: QueryIntent): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  switch (category) {
    case 'data_unavailable':
      actions.push(
        {
          id: 'retry-load',
          label: 'Retry loading data',
          action: 'Retry the operation',
        },
        {
          id: 'check-status',
          label: 'Check data status',
          action: 'What data is currently available?',
        }
      );
      break;

    case 'network_error':
      actions.push(
        {
          id: 'retry-network',
          label: 'Try again',
          action: 'Retry the operation',
        },
        {
          id: 'offline-mode',
          label: 'Work offline',
          action: 'Show me what I can do offline',
        }
      );
      break;

    case 'entity_not_found':
      actions.push(
        {
          id: 'search-entity',
          label: 'Search for entity',
          action: 'Search for similar precincts',
        },
        {
          id: 'list-available',
          label: 'List available',
          action: 'Show all available precincts',
        }
      );
      break;

    case 'validation_error':
      actions.push(
        {
          id: 'help-input',
          label: 'Get help',
          action: 'Help me with the correct input format',
        },
        {
          id: 'examples',
          label: 'Show examples',
          action: 'Show me example queries',
        }
      );
      break;

    case 'rate_limit':
      actions.push({
        id: 'wait-retry',
        label: 'Wait and retry',
        action: 'Retry in a moment',
      });
      break;

    case 'timeout':
      actions.push(
        {
          id: 'retry-timeout',
          label: 'Try again',
          action: 'Retry the operation',
        },
        {
          id: 'simplify',
          label: 'Simplify request',
          action: 'Try a simpler query',
        }
      );
      break;

    case 'service_unavailable':
      actions.push({
        id: 'check-later',
        label: 'Try later',
        action: 'Check service status',
      });
      break;

    default:
      actions.push(
        {
          id: 'try-again',
          label: 'Try again',
          action: 'Retry the operation',
        },
        {
          id: 'get-help',
          label: 'Get help',
          action: 'Help me with this',
        }
      );
  }

  // Add intent-specific action if available
  if (intent && INTENT_RECOVERY_MESSAGES[intent]) {
    actions.unshift({
      id: 'intent-specific',
      label: 'Try alternative',
      action: INTENT_RECOVERY_MESSAGES[intent]!,
    });
  }

  return actions;
}

// ============================================================================
// User Message Templates
// ============================================================================

function getUserMessage(category: ErrorCategory, context?: string): string {
  const contextSuffix = context ? ` ${context}` : '';

  switch (category) {
    case 'data_unavailable':
      return `The requested data is not currently available.${contextSuffix} Please try again or choose a different query.`;

    case 'network_error':
      return `There was a network issue connecting to the data service.${contextSuffix} Please check your connection and try again.`;

    case 'entity_not_found':
      return `I couldn't find the entity you're looking for.${contextSuffix} Try checking the spelling or searching for alternatives.`;

    case 'parsing_error':
      return `I had trouble understanding that request.${contextSuffix} Could you rephrase it?`;

    case 'validation_error':
      return `Some of the input values weren't valid.${contextSuffix} Please check the requirements and try again.`;

    case 'rate_limit':
      return `We're processing too many requests right now. Please wait a moment and try again.`;

    case 'timeout':
      return `The operation took too long to complete.${contextSuffix} Try simplifying your request or trying again.`;

    case 'service_unavailable':
      return `The analysis service is temporarily unavailable. Please try again in a few minutes.`;

    case 'permission_error':
      return `You don't have permission to perform this action.${contextSuffix}`;

    default:
      return `Something went wrong.${contextSuffix} Please try again or rephrase your request.`;
  }
}

// ============================================================================
// Main Recovery Generator
// ============================================================================

export const ErrorRecovery = {
  /**
   * Generate a recovery result for an error
   *
   * @param error - The caught error
   * @param intent - The query intent that failed (optional)
   * @param context - Additional context for the error message (optional)
   */
  generateRecovery(
    error: unknown,
    intent?: QueryIntent,
    context?: string
  ): RecoveryResult {
    const category = classifyError(error);
    const technicalMessage = error instanceof Error ? error.message : String(error);

    return {
      userMessage: getUserMessage(category, context),
      technicalMessage,
      suggestedActions: getRecoveryActions(category, intent),
      category,
      isRecoverable: category !== 'permission_error' && category !== 'service_unavailable',
      retryDelayMs: category === 'rate_limit' ? 5000 : category === 'timeout' ? 2000 : undefined,
    };
  },

  /**
   * Generate recovery for a specific category (when error is already classified)
   */
  generateForCategory(
    category: ErrorCategory,
    intent?: QueryIntent,
    context?: string
  ): RecoveryResult {
    return {
      userMessage: getUserMessage(category, context),
      technicalMessage: `Error category: ${category}`,
      suggestedActions: getRecoveryActions(category, intent),
      category,
      isRecoverable: category !== 'permission_error' && category !== 'service_unavailable',
      retryDelayMs: category === 'rate_limit' ? 5000 : category === 'timeout' ? 2000 : undefined,
    };
  },

  /**
   * Create a data unavailable recovery with specific entity info
   */
  dataUnavailable(entityType: string, entityName?: string): RecoveryResult {
    const context = entityName
      ? `for ${entityType} "${entityName}"`
      : `for ${entityType}`;

    return this.generateForCategory('data_unavailable', undefined, context);
  },

  /**
   * Create an entity not found recovery
   */
  entityNotFound(entityType: string, searchTerm: string): RecoveryResult {
    return {
      userMessage: `I couldn't find a ${entityType} matching "${searchTerm}". Try checking the spelling or searching for alternatives.`,
      technicalMessage: `Entity not found: ${entityType}/${searchTerm}`,
      suggestedActions: [
        {
          id: 'search-alternatives',
          label: `Search ${entityType}s`,
          action: `Search for ${entityType}s similar to ${searchTerm}`,
        },
        {
          id: 'list-all',
          label: 'Show all',
          action: `List all available ${entityType}s`,
        },
      ],
      category: 'entity_not_found',
      isRecoverable: true,
    };
  },

  /**
   * Create a validation error recovery with field info
   */
  validationFailed(field: string, requirement: string): RecoveryResult {
    return {
      userMessage: `The ${field} value is invalid. ${requirement}`,
      technicalMessage: `Validation failed for field: ${field}`,
      suggestedActions: [
        {
          id: 'help-format',
          label: 'Show format',
          action: `What format should ${field} be in?`,
        },
        {
          id: 'use-default',
          label: 'Use default',
          action: `Use the default value for ${field}`,
        },
      ],
      category: 'validation_error',
      isRecoverable: true,
    };
  },

  /**
   * Classify an error without generating full recovery
   */
  classify: classifyError,
};

// Types are exported inline with their declarations above
