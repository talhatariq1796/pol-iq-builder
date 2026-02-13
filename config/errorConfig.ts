// src/config/errorConfig.ts

import { AnalysisIntent } from './aiConfig';
import { ProcessingStrategy } from './processingConfig';

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';
export type ErrorDomain = 'validation' | 'processing' | 'timeout' | 'permission' | 'resource' | 'external';
export type ErrorCategory = 'validation' | 'processing' | 'timeout' | 'permission' | 'resource' | 'external';

export interface ErrorMetadata {
  timestamp: number;
  requestId?: string;
  userId?: string;
  component?: string;
  operation?: string;
}

export interface ErrorResponse {
  message: string;
  userMessage?: string;
  suggestedAction?: string;
  fallbackBehavior?: 'retry' | 'failover' | 'degrade' | 'abort';
}

export interface RetryStrategy {
  maxAttempts: number;
  backoffType: 'fixed' | 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
}

export interface RetryConfig {
  strategies: Record<ErrorDomain, RetryStrategy>;
  circuitBreaker: CircuitBreakerConfig;
}

export interface ErrorMapping {
  errorCode: string;
  response: {
    message: string;
    fallbackBehavior: 'retry' | 'fail' | 'useDefault';
    defaultValue?: any;
  };
}

export interface ErrorConfig {
  version: string;
  
  logging: {
    level: ErrorSeverity;
    destination: 'console' | 'file' | 'service';
    format: 'json' | 'text';
    metadata: string[];
    rotation?: {
      maxSize: number;
      maxFiles: number;
      compress: boolean;
    };
  };

  monitoring: {
    enabled: boolean;
    sampleRate: number;
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      failureStreak: number;
    };
    healthChecks: {
      interval: number;
      timeout: number;
      endpoints: string[];
    };
  };

  fallback: {
    responses: Record<AnalysisIntent, string>;
    processing: Record<ProcessingStrategy, ProcessingStrategy>;
    data: {
      maxStaleAge: number;
      allowStaleData: boolean;
      degradedModeThreshold: number;
    };
  };

  retry: RetryConfig;

  errorMappings: Record<ErrorDomain, ErrorMapping[]>;
}

// Default configuration
export const defaultErrorConfig: ErrorConfig = {
  version: '1.0.0',
  
  logging: {
    level: 'error',
    destination: 'console',
    format: 'json',
    metadata: ['timestamp', 'requestId', 'userId', 'component'],
    rotation: {
      maxSize: 10485760, // 10MB
      maxFiles: 5,
      compress: true
    }
  },

  monitoring: {
    enabled: true,
    sampleRate: 0.1, // 10% of errors
    alertThresholds: {
      errorRate: 0.05, // 5%
      responseTime: 5000, // 5 seconds
      failureStreak: 3
    },
    healthChecks: {
      interval: 60000, // 1 minute
      timeout: 5000,
      endpoints: ['/health', '/readiness']
    }
  },

  fallback: {
    responses: {
      CONCENTRATION: "Unable to analyze concentration patterns. Using simplified analysis.",
      COMPARISON: "Detailed comparison unavailable. Showing basic metrics.",
      TRENDS: "Trend analysis limited to available data points.",
      PROXIMITY: "Proximity analysis using cached data."
    },
    processing: {
      ai: 'traditional',
      traditional: 'hybrid',
      hybrid: 'traditional'
    },
    data: {
      maxStaleAge: 3600000, // 1 hour
      allowStaleData: true,
      degradedModeThreshold: 0.3 // 30% degradation
    }
  },

  retry: {
    strategies: {
      validation: {
        maxAttempts: 1,
        backoffType: 'fixed',
        initialDelay: 0,
        maxDelay: 0,
        jitter: false
      },
      processing: {
        maxAttempts: 3,
        backoffType: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000,
        jitter: true
      },
      timeout: {
        maxAttempts: 2,
        backoffType: 'linear',
        initialDelay: 2000,
        maxDelay: 5000,
        jitter: true
      },
      permission: {
        maxAttempts: 1,
        backoffType: 'fixed',
        initialDelay: 0,
        maxDelay: 0,
        jitter: false
      },
      resource: {
        maxAttempts: 3,
        backoffType: 'exponential',
        initialDelay: 1000,
        maxDelay: 8000,
        jitter: true
      },
      external: {
        maxAttempts: 3,
        backoffType: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000,
        jitter: true
      }
    },
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 30000
    }
  },

  errorMappings: {
    validation: [
      {
        errorCode: 'INVALID_INPUT',
        response: {
          message: 'Invalid input provided',
          fallbackBehavior: 'fail'
        }
      }
    ],
    processing: [
      {
        errorCode: 'PROCESSING_ERROR',
        response: {
          message: 'Error processing request',
          fallbackBehavior: 'retry'
        }
      }
    ],
    timeout: [
      {
        errorCode: 'REQUEST_TIMEOUT',
        response: {
          message: 'Request timed out',
          fallbackBehavior: 'retry'
        }
      }
    ],
    permission: [
      {
        errorCode: 'UNAUTHORIZED',
        response: {
          message: 'Unauthorized access',
          fallbackBehavior: 'fail'
        }
      }
    ],
    resource: [
      {
        errorCode: 'RESOURCE_NOT_FOUND',
        response: {
          message: 'Resource not found',
          fallbackBehavior: 'fail'
        }
      }
    ],
    external: [
      {
        errorCode: 'EXTERNAL_SERVICE_ERROR',
        response: {
          message: 'External service error',
          fallbackBehavior: 'retry'
        }
      }
    ]
  }
};

// Utility functions
export function handleError(
  error: Error,
  domain: ErrorDomain,
  category: ErrorCategory,
  metadata?: ErrorMetadata
): ErrorResponse {
  // Implementation of error handling logic
  return {
    message: 'Error handled',
    userMessage: 'An error occurred'
  };
}

export function shouldRetry(
  error: Error,
  attempt: number,
  category: ErrorCategory,
  config: ErrorConfig
): boolean {
  // Implementation of retry decision logic
  return false;
}

export function getErrorResponse(
  errorCode: string,
  domain: ErrorDomain,
  config: ErrorConfig
): ErrorResponse | undefined {
  // Implementation of error response lookup
  return undefined;
}

export function logError(
  error: Error,
  metadata: ErrorMetadata,
  config: ErrorConfig
): void {
  // Implementation of error logging logic
}