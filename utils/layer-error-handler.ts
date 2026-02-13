import { LayerConfig, LayerState } from '../types/layers';

// Error types for layer management
export enum LayerErrorType {
  LOAD_ERROR = 'LOAD_ERROR',
  VISIBILITY_ERROR = 'VISIBILITY_ERROR',
  OPACITY_ERROR = 'OPACITY_ERROR',
  GROUP_ERROR = 'GROUP_ERROR',
  BOOKMARK_ERROR = 'BOOKMARK_ERROR',
  FILTER_ERROR = 'FILTER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

// Error interface
export interface LayerError {
  type: LayerErrorType;
  message: string;
  details?: string;
  layerId?: string;
  timestamp: number;
  recoverable: boolean;
}

// Error recovery options
export interface ErrorRecoveryOptions {
  retryCount: number;
  maxRetries: number;
  backoffMs: number;
  timeoutMs?: number;
}

// Default error recovery configuration
export const DEFAULT_ERROR_RECOVERY: ErrorRecoveryOptions = {
  retryCount: 0,
  maxRetries: 3,
  backoffMs: 1000,
  timeoutMs: 30000
};

// Error handler class
export class LayerErrorHandler {
  private static instance: LayerErrorHandler;
  private errorLog: LayerError[] = [];
  private readonly maxErrorLogSize = 100;

  private constructor() {}

  public static getInstance(): LayerErrorHandler {
    if (!LayerErrorHandler.instance) {
      LayerErrorHandler.instance = new LayerErrorHandler();
    }
    return LayerErrorHandler.instance;
  }

  // Handle layer loading errors
  public async handleLayerLoadError(
    layerId: string,
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.LOAD_ERROR,
      message: 'Failed to load layer',
      details: error instanceof Error ? error.message : String(error),
      layerId,
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Handle layer visibility errors
  public async handleVisibilityError(
    layerId: string,
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.VISIBILITY_ERROR,
      message: 'Failed to update layer visibility',
      details: error instanceof Error ? error.message : String(error),
      layerId,
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Handle layer opacity errors
  public async handleOpacityError(
    layerId: string,
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.OPACITY_ERROR,
      message: 'Failed to update layer opacity',
      details: error instanceof Error ? error.message : String(error),
      layerId,
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Handle layer group errors
  public async handleGroupError(
    groupId: string,
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.GROUP_ERROR,
      message: 'Failed to update layer group',
      details: error instanceof Error ? error.message : String(error),
      layerId: groupId,
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Handle bookmark errors
  public async handleBookmarkError(
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.BOOKMARK_ERROR,
      message: 'Failed to manage layer bookmark',
      details: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Handle filter errors
  public async handleFilterError(
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.FILTER_ERROR,
      message: 'Failed to apply layer filter',
      details: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Handle timeout errors
  public async handleTimeoutError(
    operation: string,
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.TIMEOUT_ERROR,
      message: `Operation timed out: ${operation}`,
      details: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Handle validation errors
  public async handleValidationError(
    layerId: string,
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.VALIDATION_ERROR,
      message: 'Layer validation failed',
      details: error instanceof Error ? error.message : String(error),
      layerId,
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Handle network errors
  public async handleNetworkError(
    error: any,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<LayerError> {
    const layerError: LayerError = {
      type: LayerErrorType.NETWORK_ERROR,
      message: 'Network error occurred',
      details: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      recoverable: options.retryCount < options.maxRetries
    };

    this.logError(layerError);
    return layerError;
  }

  // Retry operation with exponential backoff
  public async retryOperation<T>(
    operation: () => Promise<T>,
    options: ErrorRecoveryOptions = DEFAULT_ERROR_RECOVERY
  ): Promise<T> {
    let lastError: Error = new Error('Operation failed after all retries');
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        if (options.timeoutMs) {
          return await Promise.race([
            operation(),
            new Promise<T>((_, reject) => 
              setTimeout(() => reject(new Error('Operation timed out')), options.timeoutMs)
            )
          ]);
        }
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === options.maxRetries) break;
        
        const delay = options.backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  // Get error log
  public getErrorLog(): LayerError[] {
    return [...this.errorLog];
  }

  // Clear error log
  public clearErrorLog(): void {
    this.errorLog = [];
  }

  // Private method to log errors
  private logError(error: LayerError): void {
    this.errorLog.unshift(error);
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.pop();
    }
    console.error('[LayerErrorHandler]', error);
  }
} 