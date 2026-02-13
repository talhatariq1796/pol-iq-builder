// src/config/monitoringConfig.ts

import { SecurityLevel } from './securityConfig';
import { HealthStatus } from './featureServiceConfig';
import { CacheLevel } from './cachingConfig';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'firing' | 'resolved' | 'acknowledged' | 'silenced';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';
export type MonitoringProvider = 'prometheus' | 'datadog' | 'newrelic' | 'custom';

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  labels?: string[];
  unit?: string;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  buckets?: number[];
}

export interface ThresholdRule {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  duration: number;
  severity: AlertSeverity;
}

export interface AlertRule {
  name: string;
  description: string;
  thresholds: ThresholdRule[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  silenced?: boolean;
  notifications: {
    channels: string[];
    groupBy?: string[];
    throttling?: number;
  };
}

export interface LoggingConfig {
  level: LogLevel;
  format: 'json' | 'text';
  timestamp: boolean;
  source: boolean;
  caller: boolean;
  stacktrace: boolean;
  rotation: {
    maxSize: number;
    maxFiles: number;
    compress: boolean;
  };
  fields: {
    static?: Record<string, string>;
    dynamic?: string[];
  };
}

export interface TraceConfig {
  enabled: boolean;
  sampleRate: number;
  exportBatchSize: number;
  maxQueueSize: number;
  exportTimeout: number;
  ignoredPaths?: string[];
  attributes?: Record<string, string>;
}

export interface HealthCheck {
  name: string;
  type: 'http' | 'tcp' | 'custom';
  endpoint?: string;
  interval: number;
  timeout: number;
  successThreshold: number;
  failureThreshold: number;
  expectedStatus?: number[];
  expectedResponse?: any;
}

export interface MonitoringConfig {
  version: string;

  general: {
    enabled: boolean;
    environment: string;
    region?: string;
    tags: Record<string, string>;
    securityLevel: SecurityLevel;
  };

  providers: Record<MonitoringProvider, {
    enabled: boolean;
    endpoint: string;
    apiKey?: string;
    options?: Record<string, any>;
  }>;

  metrics: {
    enabled: boolean;
    prefix: string;
    defaultLabels: Record<string, string>;
    collection: {
      interval: number;
      batchSize: number;
      bufferSize: number;
    };
    storage: {
      type: CacheLevel;
      retention: number;
    };
    definitions: Record<string, MetricDefinition>;
  };

  alerting: {
    enabled: boolean;
    defaultSeverity: AlertSeverity;
    evaluationInterval: number;
    rules: Record<string, AlertRule>;
    notifications: {
      email?: {
        enabled: boolean;
        from: string;
        to: string[];
        smtpConfig?: Record<string, any>;
      };
      slack?: {
        enabled: boolean;
        webhook: string;
        channel: string;
      };
      webhook?: {
        enabled: boolean;
        url: string;
        headers?: Record<string, string>;
      };
      pagerduty?: {
        enabled: boolean;
        routingKey: string;
        severity?: Record<AlertSeverity, string>;
      };
    };
  };

  logging: {
    console: LoggingConfig;
    file: LoggingConfig & {
      path: string;
    };
    remote?: {
      enabled: boolean;
      endpoint: string;
      bufferSize: number;
      retryStrategy: {
        attempts: number;
        backoff: number;
      };
    };
  };

  tracing: TraceConfig;

  health: {
    enabled: boolean;
    endpoint: string;
    checks: Record<string, HealthCheck>;
    aggregation: {
      status: Record<string, HealthStatus>;
      weights: Record<string, number>;
    };
  };

  performance: {
    enabled: boolean;
    sampling: {
      rate: number;
      duration: number;
    };
    thresholds: {
      cpu: number;
      memory: number;
      disk: number;
      latency: number;
      errorRate: number;
    };
    profiling: {
      enabled: boolean;
      interval: number;
      types: ('cpu' | 'memory' | 'goroutine')[];
    };
  };
}

// Default configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  version: '1.0.0',

  general: {
    enabled: true,
    environment: 'production',
    tags: {
      service: 'gis-analysis',
      team: 'data-science'
    },
    securityLevel: 'high'
  },

  providers: {
    prometheus: {
      enabled: true,
      endpoint: 'http://prometheus:9090',
      options: {
        scrapeInterval: '15s',
        evaluationInterval: '15s'
      }
    },
    datadog: {
      enabled: false,
      endpoint: 'https://api.datadoghq.com',
      apiKey: process.env.DATADOG_API_KEY
    },
    newrelic: {
      enabled: false,
      endpoint: 'https://metric-api.newrelic.com',
      apiKey: process.env.NEWRELIC_API_KEY
    },
    custom: {
      enabled: false,
      endpoint: 'http://custom-metrics:8080'
    }
  },

  metrics: {
    enabled: true,
    prefix: 'gis_analysis',
    defaultLabels: {
      environment: 'production',
      version: '1.0.0'
    },
    collection: {
      interval: 15000,
      batchSize: 1000,
      bufferSize: 10000
    },
    storage: {
      type: 'redis',
      retention: 604800 // 7 days
    },
    definitions: {
      'http_requests_total': {
        name: 'http_requests_total',
        type: 'counter',
        description: 'Total number of HTTP requests',
        labels: ['method', 'path', 'status']
      },
      'request_duration_seconds': {
        name: 'request_duration_seconds',
        type: 'histogram',
        description: 'HTTP request duration in seconds',
        labels: ['method', 'path'],
        buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5]
      }
      // Add more metric definitions as needed
    }
  },

  alerting: {
    enabled: true,
    defaultSeverity: 'medium',
    evaluationInterval: 60000,
    rules: {
      'high_error_rate': {
        name: 'high_error_rate',
        description: 'Error rate is above threshold',
        thresholds: [
          {
            metric: 'error_rate',
            operator: '>',
            value: 0.05,
            duration: 300000,
            severity: 'high'
          }
        ],
        notifications: {
          channels: ['email', 'slack'],
          throttling: 3600000
        }
      }
      // Add more alert rules as needed
    },
    notifications: {
      email: {
        enabled: true,
        from: 'alerts@example.com',
        to: ['team@example.com'],
        smtpConfig: {
          host: 'smtp.example.com',
          port: 587,
          secure: true
        }
      },
      slack: {
        enabled: true,
        webhook: 'https://hooks.slack.com/services/xxx',
        channel: '#alerts'
      }
    }
  },

  logging: {
    console: {
      level: 'info',
      format: 'json',
      timestamp: true,
      source: true,
      caller: true,
      stacktrace: true,
      rotation: {
        maxSize: 10485760,
        maxFiles: 5,
        compress: true
      },
      fields: {
        static: {
          service: 'gis-analysis'
        },
        dynamic: ['requestId', 'userId']
      }
    },
    file: {
      level: 'debug',
      format: 'json',
      timestamp: true,
      source: true,
      caller: true,
      stacktrace: true,
      path: '/var/log/gis-analysis',
      rotation: {
        maxSize: 104857600,
        maxFiles: 10,
        compress: true
      },
      fields: {
        static: {
          service: 'gis-analysis'
        },
        dynamic: ['requestId', 'userId', 'trace']
      }
    },
    remote: {
      enabled: true,
      endpoint: 'http://logging-service:8080',
      bufferSize: 1000,
      retryStrategy: {
        attempts: 3,
        backoff: 1000
      }
    }
  },

  tracing: {
    enabled: true,
    sampleRate: 0.1,
    exportBatchSize: 512,
    maxQueueSize: 2048,
    exportTimeout: 30000,
    ignoredPaths: ['/health', '/metrics'],
    attributes: {
      service: 'gis-analysis'
    }
  },

  health: {
    enabled: true,
    endpoint: '/health',
    checks: {
      database: {
        name: 'database',
        type: 'custom',
        interval: 30000,
        timeout: 5000,
        successThreshold: 1,
        failureThreshold: 3
      },
      cache: {
        name: 'redis',
        type: 'tcp',
        endpoint: 'redis:6379',
        interval: 15000,
        timeout: 2000,
        successThreshold: 1,
        failureThreshold: 2
      }
    },
    aggregation: {
      status: {
        database: 'healthy',
        cache: 'healthy'
      },
      weights: {
        database: 2,
        cache: 1
      }
    }
  },

  performance: {
    enabled: true,
    sampling: {
      rate: 0.1,
      duration: 60000
    },
    thresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      latency: 1000,
      errorRate: 0.05
    },
    profiling: {
      enabled: true,
      interval: 3600000,
      types: ['cpu', 'memory', 'goroutine']
    }
  }
};

// Utility functions
export function recordMetric(
  name: string,
  value: number,
  labels?: Record<string, string>
): void {
  // Implementation of metric recording
}

export function createAlert(
  ruleName: string,
  data: Record<string, any>
): void {
  // Implementation of alert creation
}

export function checkHealth(): Promise<Record<string, HealthStatus>> {
  // Implementation of health check
  return Promise.resolve({});
}

export function startTrace(
  name: string,
  attributes?: Record<string, string>
): any {
  // Implementation of trace creation
  return {};
}

export function logMessage(
  level: LogLevel,
  message: string,
  metadata?: Record<string, any>
): void {
  // Implementation of logging
}