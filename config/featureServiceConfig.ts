// src/config/featureServiceConfig.ts

export type LayerType = 'feature' | 'imagery' | 'vector' | 'raster';
import { CacheLevel } from './cachingConfig';
import { SecurityLevel } from './securityConfig';

export type ServiceProvider = 'arcgis' | 'mapbox' | 'carto' | 'custom';
export type ServiceProtocol = 'rest' | 'wfs' | 'wms' | 'wmts' | 'vector-tile';
export type ServiceVersion = '1.0.0' | '2.0.0' | '3.0.0';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type LoadBalanceStrategy = 'round-robin' | 'least-connections' | 'weighted';

export interface ServiceEndpoint {
  url: string;
  protocol: ServiceProtocol;
  version: ServiceVersion;
  weight?: number;
  priority?: number;
  metadata?: {
    region?: string;
    datacenter?: string;
    provider?: string;
  };
}

export interface ConnectionPool {
  minSize: number;
  maxSize: number;
  idleTimeout: number;
  acquireTimeout: number;
  evictionInterval: number;
  validateOnBorrow: boolean;
}

export interface RetryStrategy {
  attempts: number;
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  randomization: boolean;
  conditions: {
    networkErrors: boolean;
    timeouts: boolean;
    serverErrors: boolean;
    rateLimiting: boolean;
  };
}

export interface CircuitBreaker {
  enabled: boolean;
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
  windowSize: number;
}

export interface ServiceTransformation {
  request?: {
    headers?: Record<string, string>;
    parameters?: Record<string, any>;
    bodyTransform?: string;
  };
  response?: {
    fields?: Record<string, string>;
    geometryTransform?: string;
    attributeTransform?: string;
  };
}

export interface ServiceMonitoring {
  enabled: boolean;
  interval: number;
  timeout: number;
  healthCheck: {
    endpoint: string;
    method: string;
    expectedStatus: number[];
    requiredFields?: string[];
  };
  metrics: {
    responseTime: boolean;
    errorRate: boolean;
    availability: boolean;
    throughput: boolean;
  };
  alerts: {
    enabled: boolean;
    thresholds: {
      responseTime: number;
      errorRate: number;
      availability: number;
    };
    channels: {
      email?: string[];
      webhook?: string;
      slack?: string;
    };
  };
}

export interface ServiceQuota {
  requests: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
  data: {
    maxFeatures: number;
    maxGeometry: number;
    maxPayload: number;
  };
  users: {
    concurrent: number;
    total: number;
  };
}

export interface FeatureServiceConfig {
  version: string;

  providers: Record<ServiceProvider, {
    baseUrl: string;
    apiKey?: string;
    defaultProtocol: ServiceProtocol;
    defaultVersion: ServiceVersion;
  }>;

  endpoints: {
    primary: ServiceEndpoint;
    fallback: ServiceEndpoint[];
    loadBalancing: {
      enabled: boolean;
      strategy: LoadBalanceStrategy;
      healthCheck: boolean;
    };
  };

  connection: {
    pool: ConnectionPool;
    timeout: {
      connect: number;
      read: number;
      write: number;
    };
    keepAlive: boolean;
    compression: boolean;
  };

  retry: RetryStrategy;
  
  circuitBreaker: CircuitBreaker;

  transformation: {
    global: ServiceTransformation;
    byType: Partial<Record<LayerType, ServiceTransformation>>;
    byProvider: Partial<Record<ServiceProvider, ServiceTransformation>>;
  };

  monitoring: ServiceMonitoring;

  caching: {
    enabled: boolean;
    level: CacheLevel;
    ttl: number;
    strategies: {
      queryResults: boolean;
      metadata: boolean;
      tiles: boolean;
    };
  };

  security: {
    level: SecurityLevel;
    encryption: boolean;
    authentication: {
      required: boolean;
      method: string;
    };
    rateLimit: {
      enabled: boolean;
      requestsPerSecond: number;
    };
  };

  quotas: Record<string, ServiceQuota>;

  optimization: {
    queryOptimization: boolean;
    geometrySimplification: boolean;
    attributeFiltering: boolean;
    spatialIndexing: boolean;
    batchProcessing: {
      enabled: boolean;
      maxSize: number;
      timeout: number;
    };
  };
}

// Default configuration
export const defaultFeatureServiceConfig: FeatureServiceConfig = {
  version: '1.0.0',

  providers: {
    arcgis: {
      baseUrl: 'https://services.arcgis.com',
      defaultProtocol: 'rest',
      defaultVersion: '2.0.0'
    },
    mapbox: {
      baseUrl: 'https://api.mapbox.com',
      defaultProtocol: 'vector-tile',
      defaultVersion: '1.0.0'
    },
    carto: {
      baseUrl: 'https://api.carto.com',
      defaultProtocol: 'rest',
      defaultVersion: '2.0.0'
    },
    custom: {
      baseUrl: 'https://custom.example.com',
      defaultProtocol: 'rest',
      defaultVersion: '1.0.0'
    }
  },

  endpoints: {
    primary: {
      url: 'https://services.arcgis.com/primary',
      protocol: 'rest',
      version: '2.0.0',
      metadata: {
        region: 'us-east-1',
        provider: 'arcgis'
      }
    },
    fallback: [
      {
        url: 'https://services.arcgis.com/fallback1',
        protocol: 'rest',
        version: '2.0.0',
        priority: 1
      },
      {
        url: 'https://services.arcgis.com/fallback2',
        protocol: 'rest',
        version: '2.0.0',
        priority: 2
      }
    ],
    loadBalancing: {
      enabled: true,
      strategy: 'least-connections',
      healthCheck: true
    }
  },

  connection: {
    pool: {
      minSize: 5,
      maxSize: 50,
      idleTimeout: 30000,
      acquireTimeout: 5000,
      evictionInterval: 15000,
      validateOnBorrow: true
    },
    timeout: {
      connect: 5000,
      read: 30000,
      write: 30000
    },
    keepAlive: true,
    compression: true
  },

  retry: {
    attempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    multiplier: 2,
    randomization: true,
    conditions: {
      networkErrors: true,
      timeouts: true,
      serverErrors: true,
      rateLimiting: true
    }
  },

  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    resetTimeout: 30000,
    halfOpenRequests: 3,
    windowSize: 60000
  },

  transformation: {
    global: {
      request: {
        headers: {
          'Accept-Encoding': 'gzip',
          'User-Agent': 'GIS-Service-Client/1.0'
        }
      },
      response: {
        fields: {
          'OBJECTID': 'id',
          'Shape': 'geometry'
        }
      }
    },
    byType: {
      feature: {
        response: {
          geometryTransform: 'simplify',
          attributeTransform: 'camelCase'
        }
      }
    },
    byProvider: {}
  },

  monitoring: {
    enabled: true,
    interval: 60000,
    timeout: 5000,
    healthCheck: {
      endpoint: '/health',
      method: 'GET',
      expectedStatus: [200, 201, 204],
      requiredFields: ['status', 'version']
    },
    metrics: {
      responseTime: true,
      errorRate: true,
      availability: true,
      throughput: true
    },
    alerts: {
      enabled: true,
      thresholds: {
        responseTime: 2000,
        errorRate: 0.05,
        availability: 0.99
      },
      channels: {
        email: ['ops@example.com'],
        webhook: 'https://alerts.example.com/service'
      }
    }
  },

  caching: {
    enabled: true,
    level: 'redis',
    ttl: 3600,
    strategies: {
      queryResults: true,
      metadata: true,
      tiles: true
    }
  },

  security: {
    level: 'high',
    encryption: true,
    authentication: {
      required: true,
      method: 'token'
    },
    rateLimit: {
      enabled: true,
      requestsPerSecond: 10
    }
  },

  quotas: {
    default: {
      requests: {
        perSecond: 10,
        perMinute: 600,
        perHour: 30000
      },
      data: {
        maxFeatures: 10000,
        maxGeometry: 5000000,
        maxPayload: 10485760
      },
      users: {
        concurrent: 100,
        total: 1000
      }
    }
  },

  optimization: {
    queryOptimization: true,
    geometrySimplification: true,
    attributeFiltering: true,
    spatialIndexing: true,
    batchProcessing: {
      enabled: true,
      maxSize: 1000,
      timeout: 30000
    }
  }
};

// Utility functions
export function getServiceEndpoint(
  provider: ServiceProvider,
  type: LayerType
): ServiceEndpoint {
  // Implementation of endpoint resolution
  return defaultFeatureServiceConfig.endpoints.primary;
}

export function checkServiceHealth(
  endpoint: ServiceEndpoint
): Promise<HealthStatus> {
  // Implementation of health check
  return Promise.resolve('healthy');
}

export function transformRequest(
  request: Record<string, any>,
  type: LayerType
): Record<string, any> {
  // Implementation of request transformation
  return request;
}

export function transformResponse(
  response: Record<string, any>,
  type: LayerType
): Record<string, any> {
  // Implementation of response transformation
  return response;
}

export function checkQuota(
  userId: string,
  quotaType: keyof ServiceQuota
): boolean {
  // Implementation of quota checking
  return true;
}