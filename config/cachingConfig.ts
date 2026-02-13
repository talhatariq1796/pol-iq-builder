// src/config/cachingConfig.ts

export type LayerType = 'feature' | 'imagery' | 'vector' | 'raster';
import { AnalysisIntent } from './aiConfig';

export type CacheLevel = 'memory' | 'redis' | 'distributed';
export type EvictionPolicy = 'lru' | 'lfu' | 'fifo' | 'weighted';
export type CachePriority = 'high' | 'medium' | 'low';

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsage: number;
  responseTime: number;
}

export interface CacheThresholds {
  minHitRate: number;
  maxMissRate: number;
  maxEvictionRate: number;
  maxMemoryUsage: number;
  maxResponseTime: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxConnections: number;
  connectionTimeout: number;
  commandTimeout: number;
  keyPrefix?: string;
  cluster?: {
    enabled: boolean;
    nodes: string[];
    maxRedirections: number;
  };
}

export interface DistributedConfig {
  provider: 'hazelcast' | 'memcached' | 'custom';
  nodes: string[];
  partitionCount: number;
  backupCount: number;
  consistency: 'strong' | 'eventual';
}

export interface CacheEntryConfig {
  ttl: number;
  priority: CachePriority;
  compression?: boolean;
  encryption?: boolean;
  tags?: string[];
}

export interface LayerCacheConfig {
  enabled: boolean;
  level: CacheLevel;
  entryConfig: CacheEntryConfig;
  prefetch?: {
    enabled: boolean;
    interval: number;
    conditions?: Record<string, any>;
  };
  invalidation?: {
    onUpdate: boolean;
    onDelete: boolean;
    cascading: boolean;
  };
}

export interface AnalysisCacheConfig {
  enabled: boolean;
  level: CacheLevel;
  entryConfig: CacheEntryConfig;
  revalidation?: {
    interval: number;
    strategy: 'full' | 'incremental';
  };
}

export interface CachingConfig {
  version: string;
  
  global: {
    enabled: boolean;
    metrics: {
      enabled: boolean;
      sampleRate: number;
      thresholds: CacheThresholds;
    };
    monitoring: {
      interval: number;
      alerts: boolean;
      detailed: boolean;
    };
  };

  memory: {
    maxSize: number;
    evictionPolicy: EvictionPolicy;
    cleanupInterval: number;
    compression: boolean;
  };

  redis: RedisConfig;
  
  distributed: DistributedConfig;

  layers: {
    defaults: LayerCacheConfig;
    byType: Partial<Record<LayerType, LayerCacheConfig>>;
    byId: Record<string, LayerCacheConfig>;
  };

  analysis: {
    defaults: AnalysisCacheConfig;
    byIntent: Partial<Record<AnalysisIntent, AnalysisCacheConfig>>;
  };

  invalidation: {
    strategies: {
      time: {
        enabled: boolean;
        defaultTTL: number;
      };
      version: {
        enabled: boolean;
        strict: boolean;
      };
      dependency: {
        enabled: boolean;
        cascading: boolean;
      };
    };
    patterns: {
      [key: string]: {
        pattern: string;
        ttl: number;
        priority: CachePriority;
      };
    };
  };

  optimization: {
    compression: {
      enabled: boolean;
      threshold: number;
      algorithm: 'gzip' | 'brotli' | 'lz4';
    };
    batching: {
      enabled: boolean;
      maxSize: number;
      maxDelay: number;
    };
    prefetch: {
      enabled: boolean;
      threshold: number;
      maxConcurrent: number;
    };
  };
}

// Default configuration
export const defaultCachingConfig: CachingConfig = {
  version: '1.0.0',
  
  global: {
    enabled: true,
    metrics: {
      enabled: true,
      sampleRate: 0.1,
      thresholds: {
        minHitRate: 0.7,
        maxMissRate: 0.3,
        maxEvictionRate: 0.1,
        maxMemoryUsage: 0.9,
        maxResponseTime: 100
      }
    },
    monitoring: {
      interval: 60000,
      alerts: true,
      detailed: true
    }
  },

  memory: {
    maxSize: 1024 * 1024 * 1024, // 1GB
    evictionPolicy: 'lru',
    cleanupInterval: 300000, // 5 minutes
    compression: true
  },

  redis: {
    host: 'localhost',
    port: 6379,
    maxConnections: 50,
    connectionTimeout: 5000,
    commandTimeout: 2000,
    keyPrefix: 'gis:cache:',
    cluster: {
      enabled: false,
      nodes: [],
      maxRedirections: 16
    }
  },

  distributed: {
    provider: 'hazelcast',
    nodes: ['cache-1:5701', 'cache-2:5701'],
    partitionCount: 271,
    backupCount: 1,
    consistency: 'eventual'
  },

  layers: {
    defaults: {
      enabled: true,
      level: 'memory',
      entryConfig: {
        ttl: 3600000, // 1 hour
        priority: 'medium',
        compression: true
      }
    },
    byType: {
      feature: {
        enabled: true,
        level: 'redis',
        entryConfig: {
          ttl: 86400000, // 24 hours
          priority: 'high',
          compression: true,
          encryption: true
        },
        prefetch: {
          enabled: true,
          interval: 3600000 // 1 hour
        }
      },
      imagery: {
        enabled: true,
        level: 'distributed',
        entryConfig: {
          ttl: 604800000, // 1 week
          priority: 'medium',
          compression: true
        }
      }
    },
    byId: {}
  },

  analysis: {
    defaults: {
      enabled: true,
      level: 'memory',
      entryConfig: {
        ttl: 1800000, // 30 minutes
        priority: 'medium'
      }
    },
    byIntent: {
      CONCENTRATION: {
        enabled: true,
        level: 'redis',
        entryConfig: {
          ttl: 3600000, // 1 hour
          priority: 'high'
        },
        revalidation: {
          interval: 900000, // 15 minutes
          strategy: 'incremental'
        }
      }
    }
  },

  invalidation: {
    strategies: {
      time: {
        enabled: true,
        defaultTTL: 3600000 // 1 hour
      },
      version: {
        enabled: true,
        strict: false
      },
      dependency: {
        enabled: true,
        cascading: true
      }
    },
    patterns: {
      demographics: {
        pattern: 'demographics:*',
        ttl: 86400000, // 24 hours
        priority: 'high'
      }
    }
  },

  optimization: {
    compression: {
      enabled: true,
      threshold: 1024, // 1KB
      algorithm: 'gzip'
    },
    batching: {
      enabled: true,
      maxSize: 100,
      maxDelay: 50 // ms
    },
    prefetch: {
      enabled: true,
      threshold: 0.8,
      maxConcurrent: 5
    }
  }
};

// Utility functions
export function getCacheConfig(
  type: 'layer' | 'analysis',
  id: string
): LayerCacheConfig | AnalysisCacheConfig {
  // Implementation of cache config resolution
  return defaultCachingConfig[type === 'layer' ? 'layers' : 'analysis'].defaults;
}

export function shouldCache(
  type: 'layer' | 'analysis',
  id: string,
  metrics: CacheMetrics
): boolean {
  // Implementation of cache decision logic
  return true;
}

export function getCacheKey(
  type: 'layer' | 'analysis',
  id: string,
  params: Record<string, any>
): string {
  // Implementation of cache key generation
  return `${type}:${id}:${JSON.stringify(params)}`;
}

export function validateCacheConfig(config: Partial<CachingConfig>): boolean {
  // Implementation of config validation
  return true;
}