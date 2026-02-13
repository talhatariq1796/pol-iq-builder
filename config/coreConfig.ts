// src/config/coreConfig.ts

import { VisualizationType } from './aiConfig';

export type RetryStrategy = 'exponential' | 'linear' | 'fixed';
export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  strategy: RetryStrategy;
  jitter?: boolean;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'enum' | 'custom';
  severity: ValidationSeverity;
  message: string;
  validator?: (value: any) => boolean;
  params?: Record<string, any>;
}

export interface VisualizationStyle {
  color: string[];
  opacity: number;
  weight: number;
  radius?: number;
  fillColor?: string;
  dashArray?: string;
}

export interface CoreSystemConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  
  layerController: {
    updateInterval: number; // milliseconds
    maxConcurrentRequests: number;
    retryStrategy: RetryConfig;
    validationRules: ValidationRule[];
    batchSize: number;
    cacheEnabled: boolean;
    cacheDuration: number; // milliseconds
  };
  
  visualization: {
    refreshRate: number; // milliseconds
    maxDataPoints: number;
    defaultStyles: Record<VisualizationType, VisualizationStyle>;
    animationDuration: number;
    clusteringThreshold: number;
    performanceMode: {
      enabled: boolean;
      threshold: number; // number of features
      simplificationTolerance: number;
    };
  };
  
  featureServices: {
    endpoints: {
      demographics: string;
      businesses: string;
      marketIndices: string;
    };
    timeout: number; // milliseconds
    batchSize: number;
    retryConfig: RetryConfig;
    caching: {
      enabled: boolean;
      duration: number; // milliseconds
      maxEntries: number;
    };
  };
  
  security: {
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
    tokenExpiration: number; // milliseconds
    requiredHeaders: string[];
  };
}

// Default configuration
export const defaultCoreConfig: CoreSystemConfig = {
  version: '1.0.0',
  environment: 'development',
  
  layerController: {
    updateInterval: 5000,
    maxConcurrentRequests: 5,
    retryStrategy: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      strategy: 'exponential',
      jitter: true
    },
    validationRules: [
      {
        field: 'id',
        type: 'required',
        severity: 'error',
        message: 'Layer ID is required'
      },
      {
        field: 'url',
        type: 'format',
        severity: 'error',
        message: 'Invalid URL format',
        params: { format: 'url' }
      }
    ],
    batchSize: 100,
    cacheEnabled: true,
    cacheDuration: 300000 // 5 minutes
  },
  
  visualization: {
    refreshRate: 1000,
    maxDataPoints: 10000,
    defaultStyles: {
      heatmap: {
        color: ['#ff0000', '#00ff00', '#0000ff'],
        opacity: 0.7,
        weight: 1
      },
      choropleth: {
        color: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
        opacity: 0.8,
        weight: 1
      },
      point: {
        color: ['#3388ff'],
        opacity: 1,
        weight: 2,
        radius: 6,
        fillColor: '#3388ff',
        dashArray: ''
      }
    },
    animationDuration: 300,
    clusteringThreshold: 1000,
    performanceMode: {
      enabled: true,
      threshold: 50000,
      simplificationTolerance: 0.01
    }
  },
  
  featureServices: {
    endpoints: {
      demographics: 'https://services.arcgis.com/demographics',
      businesses: 'https://services.arcgis.com/businesses',
      marketIndices: 'https://services.arcgis.com/market-indices'
    },
    timeout: 30000,
    batchSize: 1000,
    retryConfig: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      strategy: 'exponential'
    },
    caching: {
      enabled: true,
      duration: 3600000, // 1 hour
      maxEntries: 1000
    }
  },
  
  security: {
    rateLimit: {
      windowMs: 900000, // 15 minutes
      maxRequests: 100
    },
    tokenExpiration: 86400000, // 24 hours
    requiredHeaders: ['x-api-key', 'x-client-id']
  }
};

// Utility functions for config validation and access
export function validateConfig(config: Partial<CoreSystemConfig>): ValidationRule[] {
  const violations: ValidationRule[] = [];
  // Implementation of config validation logic
  return violations;
}

export function getEnvironmentConfig(env: string): CoreSystemConfig {
  // Implementation of environment-specific config loading
  return defaultCoreConfig;
}

export function mergeConfigs(base: CoreSystemConfig, override: Partial<CoreSystemConfig>): CoreSystemConfig {
  // Implementation of deep config merging
  return { ...base, ...override };
}