// src/config/processingConfig.ts

import { AnalysisIntent } from './aiConfig';

export type ProcessingStrategy = 'ai' | 'traditional' | 'hybrid';
export type CacheStrategy = 'memory' | 'redis' | 'hybrid';
export type PriorityLevel = 'high' | 'medium' | 'low';

export interface ComplexityMetrics {
  dataSize: number;
  joinComplexity: number;
  spatialComplexity: number;
  temporalComplexity: number;
}

export interface PerformanceThresholds {
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface PriorityConfig {
  rules: Array<{
    condition: string;
    priority: PriorityLevel;
  }>;
  defaultPriority: PriorityLevel;
}

export interface ProcessingConfig {
  hybrid: {
    thresholds: {
      complexity: ComplexityMetrics;
      confidence: number;
      performance: PerformanceThresholds;
    };
    strategySelection: Record<AnalysisIntent, {
      defaultStrategy: ProcessingStrategy;
      fallbackStrategy: ProcessingStrategy;
      thresholdMultiplier: number;
    }>;
    adaptiveThresholds: {
      enabled: boolean;
      learningRate: number;
      minSamples: number;
    };
  };
  
  caching: {
    strategy: CacheStrategy;
    ttl: Record<string, number>;
    maxSize: number;
    redis?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
    };
    prioritization: {
      maxPriority: number;
      algorithm: 'lru' | 'lfu' | 'fifo';
    };
  };
  
  queuing: {
    maxConcurrent: number;
    timeout: number;
    prioritization: PriorityConfig;
    retryConfig: {
      maxAttempts: number;
      backoff: {
        type: 'exponential' | 'linear';
        baseDelay: number;
      };
    };
  };
  
  optimization: {
    batchSize: number;
    parallelization: {
      enabled: boolean;
      maxWorkers: number;
      minBatchSize: number;
    };
    resourceLimits: {
      maxMemory: number;
      maxCpu: number;
      timeout: number;
    };
  };
}

// Default configuration
export const defaultProcessingConfig: ProcessingConfig = {
  hybrid: {
    thresholds: {
      complexity: {
        dataSize: 1000000, // 1M records
        joinComplexity: 3, // number of joins
        spatialComplexity: 0.7, // normalized 0-1
        temporalComplexity: 0.5 // normalized 0-1
      },
      confidence: 0.8,
      performance: {
        responseTime: 5000, // ms
        memoryUsage: 512, // MB
        cpuUsage: 80 // percent
      }
    },
    strategySelection: {
      CONCENTRATION: {
        defaultStrategy: 'traditional',
        fallbackStrategy: 'hybrid',
        thresholdMultiplier: 1.0
      },
      COMPARISON: {
        defaultStrategy: 'hybrid',
        fallbackStrategy: 'traditional',
        thresholdMultiplier: 1.2
      },
      TRENDS: {
        defaultStrategy: 'ai',
        fallbackStrategy: 'hybrid',
        thresholdMultiplier: 0.8
      },
      PROXIMITY: {
        defaultStrategy: 'traditional',
        fallbackStrategy: 'hybrid',
        thresholdMultiplier: 1.0
      }
    },
    adaptiveThresholds: {
      enabled: true,
      learningRate: 0.1,
      minSamples: 100
    }
  },
  
  caching: {
    strategy: 'hybrid',
    ttl: {
      default: 3600, // 1 hour
      spatial: 7200, // 2 hours
      demographic: 86400, // 24 hours
      computed: 1800 // 30 minutes
    },
    maxSize: 1024, // MB
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0
    },
    prioritization: {
      maxPriority: 10,
      algorithm: 'lru'
    }
  },
  
  queuing: {
    maxConcurrent: 10,
    timeout: 30000, // 30 seconds
    prioritization: {
      rules: [
        {
          condition: 'user.type === "premium"',
          priority: 'high'
        },
        {
          condition: 'analysis.type === "PROXIMITY"',
          priority: 'medium'
        }
      ],
      defaultPriority: 'low'
    },
    retryConfig: {
      maxAttempts: 3,
      backoff: {
        type: 'exponential',
        baseDelay: 1000
      }
    }
  },
  
  optimization: {
    batchSize: 1000,
    parallelization: {
      enabled: true,
      maxWorkers: 4,
      minBatchSize: 100
    },
    resourceLimits: {
      maxMemory: 1024, // MB
      maxCpu: 80, // percent
      timeout: 60000 // 1 minute
    }
  }
};

// Utility functions
export function calculateComplexity(metrics: Partial<ComplexityMetrics>): number {
  // Implementation of complexity calculation
  return 0;
}

export function shouldUseHybridProcessing(
  metrics: ComplexityMetrics,
  intent: AnalysisIntent,
  config: ProcessingConfig
): boolean {
  // Implementation of processing strategy decision logic
  return false;
}

export function getOptimalBatchSize(
  dataSize: number,
  complexity: number,
  config: ProcessingConfig
): number {
  // Implementation of batch size optimization
  return config.optimization.batchSize;
}