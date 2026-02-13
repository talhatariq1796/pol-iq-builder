// src/config/agentConfig.ts

import { AnalysisIntent } from './aiConfig';
import { SecurityLevel } from './securityConfig';
import { LogLevel } from './monitoringConfig';

export type AgentType = 'router' | 'siteAnalysis' | 'customerInsights' | 'marketAnalysis' | 'visualization';
export type AgentStatus = 'idle' | 'active' | 'busy' | 'degraded' | 'error';
export type AgentPriority = 'critical' | 'high' | 'medium' | 'low';
export type CommunicationPattern = 'request-response' | 'publish-subscribe' | 'event-driven';
export type CoordinationStrategy = 'master-slave' | 'peer-to-peer' | 'hierarchical';

export interface AgentCapability {
  intent: AnalysisIntent;
  maxComplexity: number;
  supportedDataTypes: string[];
  requiredResources: string[];
  timeout: number;
}

export interface ResourceRequirements {
  cpu: {
    min: number;
    target: number;
    max: number;
  };
  memory: {
    min: number;
    target: number;
    max: number;
  };
  storage?: {
    min: number;
    target: number;
    max: number;
  };
}

export interface CommunicationConfig {
  pattern: CommunicationPattern;
  timeout: number;
  retries: number;
  queueSize: number;
  compression: boolean;
  encryption: boolean;
}

export interface FallbackStrategy {
  enabled: boolean;
  triggers: {
    timeout: number;
    errorThreshold: number;
    memoryThreshold: number;
    cpuThreshold: number;
  };
  actions: {
    retry: boolean;
    redirect: boolean;
    degrade: boolean;
    notify: boolean;
  };
}

export interface AgentTypeConfig {
  enabled: boolean;
  priority: AgentPriority;
  capabilities: AgentCapability[];
  resources: ResourceRequirements;
  scaling: {
    min: number;
    max: number;
    targetCpuUtilization: number;
    targetMemoryUtilization: number;
  };
  communication: CommunicationConfig;
  fallback: FallbackStrategy;
}

export interface CoordinationConfig {
  strategy: CoordinationStrategy;
  leaderElection: {
    enabled: boolean;
    timeout: number;
    heartbeatInterval: number;
  };
  stateSync: {
    enabled: boolean;
    interval: number;
    consistency: 'strong' | 'eventual';
  };
  workDistribution: {
    strategy: 'round-robin' | 'least-loaded' | 'capability-based';
    rebalanceInterval: number;
  };
}

export interface AgentLogging {
  level: LogLevel;
  components: string[];
  metrics: string[];
  events: string[];
}

export interface AgentSecurity {
  level: SecurityLevel;
  authentication: {
    required: boolean;
    method: string;
  };
  authorization: {
    enabled: boolean;
    roles: string[];
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
  };
}

export interface AgentConfig {
  version: string;

  global: {
    enabled: boolean;
    environment: string;
    region?: string;
    maxAgents: number;
    defaultTimeout: number;
    recoveryMode: 'automatic' | 'manual' | 'supervised';
  };

  agents: Record<AgentType, AgentTypeConfig>;

  coordination: CoordinationConfig;

  communication: {
    protocol: 'grpc' | 'websocket' | 'http2';
    compression: boolean;
    timeout: number;
    keepAlive: boolean;
    maxRetries: number;
    backoff: {
      initial: number;
      max: number;
      multiplier: number;
    };
  };

  monitoring: {
    enabled: boolean;
    interval: number;
    metrics: string[];
    healthCheck: {
      enabled: boolean;
      interval: number;
      timeout: number;
    };
  };

  logging: AgentLogging;

  security: AgentSecurity;

  lifecycle: {
    startupTimeout: number;
    shutdownTimeout: number;
    restartPolicy: 'always' | 'on-failure' | 'never';
    healthyThreshold: number;
    unhealthyThreshold: number;
  };

  resourceManagement: {
    enabled: boolean;
    reservations: boolean;
    limits: boolean;
    overcommitRatio: number;
    preemptionPolicy: 'never' | 'low-priority' | 'always';
  };

  errorHandling: {
    retryAttempts: number;
    retryDelay: number;
    failureThreshold: number;
    circuitBreaker: {
      enabled: boolean;
      threshold: number;
      timeout: number;
    };
  };
}

// Default configuration
export const defaultAgentConfig: AgentConfig = {
  version: '1.0.0',

  global: {
    enabled: true,
    environment: 'production',
    maxAgents: 100,
    defaultTimeout: 30000,
    recoveryMode: 'automatic'
  },

  agents: {
    router: {
      enabled: true,
      priority: 'critical',
      capabilities: [
        {
          intent: 'CONCENTRATION',
          maxComplexity: 100,
          supportedDataTypes: ['vector', 'raster'],
          requiredResources: ['cpu', 'memory'],
          timeout: 30000
        }
      ],
      resources: {
        cpu: {
          min: 0.1,
          target: 0.5,
          max: 1.0
        },
        memory: {
          min: 256,
          target: 512,
          max: 1024
        }
      },
      scaling: {
        min: 2,
        max: 10,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 80
      },
      communication: {
        pattern: 'request-response',
        timeout: 5000,
        retries: 3,
        queueSize: 1000,
        compression: true,
        encryption: true
      },
      fallback: {
        enabled: true,
        triggers: {
          timeout: 5000,
          errorThreshold: 0.1,
          memoryThreshold: 90,
          cpuThreshold: 80
        },
        actions: {
          retry: true,
          redirect: true,
          degrade: true,
          notify: true
        }
      }
    },
    siteAnalysis: {
      enabled: true,
      priority: 'high',
      capabilities: [
        {
          intent: 'PROXIMITY',
          maxComplexity: 80,
          supportedDataTypes: ['vector'],
          requiredResources: ['cpu', 'memory'],
          timeout: 45000
        }
      ],
      resources: {
        cpu: {
          min: 0.2,
          target: 0.6,
          max: 1.0
        },
        memory: {
          min: 512,
          target: 1024,
          max: 2048
        }
      },
      scaling: {
        min: 1,
        max: 5,
        targetCpuUtilization: 75,
        targetMemoryUtilization: 80
      },
      communication: {
        pattern: 'request-response',
        timeout: 10000,
        retries: 2,
        queueSize: 500,
        compression: true,
        encryption: true
      },
      fallback: {
        enabled: true,
        triggers: {
          timeout: 8000,
          errorThreshold: 0.15,
          memoryThreshold: 85,
          cpuThreshold: 75
        },
        actions: {
          retry: true,
          redirect: true,
          degrade: true,
          notify: true
        }
      }
    },
    customerInsights: {
      enabled: true,
      priority: 'medium',
      capabilities: [
        {
          intent: 'COMPARISON',
          maxComplexity: 60,
          supportedDataTypes: ['vector', 'tabular'],
          requiredResources: ['cpu', 'memory'],
          timeout: 40000
        }
      ],
      resources: {
        cpu: {
          min: 0.1,
          target: 0.4,
          max: 0.8
        },
        memory: {
          min: 256,
          target: 512,
          max: 1024
        }
      },
      scaling: {
        min: 1,
        max: 5,
        targetCpuUtilization: 70,
        targetMemoryUtilization: 75
      },
      communication: {
        pattern: 'event-driven',
        timeout: 7000,
        retries: 2,
        queueSize: 300,
        compression: true,
        encryption: true
      },
      fallback: {
        enabled: true,
        triggers: {
          timeout: 6000,
          errorThreshold: 0.2,
          memoryThreshold: 80,
          cpuThreshold: 70
        },
        actions: {
          retry: true,
          redirect: false,
          degrade: true,
          notify: true
        }
      }
    },
    marketAnalysis: {
      enabled: true,
      priority: 'high',
      capabilities: [
        {
          intent: 'TRENDS',
          maxComplexity: 70,
          supportedDataTypes: ['vector', 'tabular', 'temporal'],
          requiredResources: ['cpu', 'memory'],
          timeout: 50000
        }
      ],
      resources: {
        cpu: {
          min: 0.2,
          target: 0.6,
          max: 1.0
        },
        memory: {
          min: 512,
          target: 1024,
          max: 2048
        }
      },
      scaling: {
        min: 1,
        max: 5,
        targetCpuUtilization: 75,
        targetMemoryUtilization: 80
      },
      communication: {
        pattern: 'request-response',
        timeout: 8000,
        retries: 3,
        queueSize: 400,
        compression: true,
        encryption: true
      },
      fallback: {
        enabled: true,
        triggers: {
          timeout: 7000,
          errorThreshold: 0.15,
          memoryThreshold: 85,
          cpuThreshold: 75
        },
        actions: {
          retry: true,
          redirect: true,
          degrade: true,
          notify: true
        }
      }
    },
    visualization: {
      enabled: true,
      priority: 'medium',
      capabilities: [
        {
          intent: 'CONCENTRATION',
          maxComplexity: 50,
          supportedDataTypes: ['vector', 'raster', 'tabular'],
          requiredResources: ['cpu', 'memory'],
          timeout: 25000
        }
      ],
      resources: {
        cpu: {
          min: 0.1,
          target: 0.3,
          max: 0.6
        },
        memory: {
          min: 256,
          target: 512,
          max: 1024
        }
      },
      scaling: {
        min: 1,
        max: 3,
        targetCpuUtilization: 65,
        targetMemoryUtilization: 70
      },
      communication: {
        pattern: 'request-response',
        timeout: 5000,
        retries: 2,
        queueSize: 200,
        compression: true,
        encryption: true
      },
      fallback: {
        enabled: true,
        triggers: {
          timeout: 4000,
          errorThreshold: 0.2,
          memoryThreshold: 75,
          cpuThreshold: 65
        },
        actions: {
          retry: true,
          redirect: false,
          degrade: true,
          notify: true
        }
      }
    }
  },

  coordination: {
    strategy: 'hierarchical',
    leaderElection: {
      enabled: true,
      timeout: 5000,
      heartbeatInterval: 1000
    },
    stateSync: {
      enabled: true,
      interval: 5000,
      consistency: 'eventual'
    },
    workDistribution: {
      strategy: 'capability-based',
      rebalanceInterval: 30000
    }
  },

  communication: {
    protocol: 'grpc',
    compression: true,
    timeout: 10000,
    keepAlive: true,
    maxRetries: 3,
    backoff: {
      initial: 100,
      max: 10000,
      multiplier: 2
    }
  },

  monitoring: {
    enabled: true,
    interval: 15000,
    metrics: [
      'agent.status',
      'agent.memory.usage',
      'agent.cpu.usage',
      'agent.requests.total',
      'agent.errors.total'
    ],
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 5000
    }
  },

  logging: {
    level: 'info',
    components: ['coordinator', 'worker', 'communicator'],
    metrics: ['status', 'performance', 'errors'],
    events: ['startup', 'shutdown', 'error', 'recovery']
  },

  security: {
    level: 'high',
    authentication: {
      required: true,
      method: 'jwt'
    },
    authorization: {
      enabled: true,
      roles: ['admin', 'worker', 'monitor']
    },
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm'
    }
  },

  lifecycle: {
    startupTimeout: 30000,
    shutdownTimeout: 30000,
    restartPolicy: 'on-failure',
    healthyThreshold: 3,
    unhealthyThreshold: 3
  },

  resourceManagement: {
    enabled: true,
    reservations: true,
    limits: true,
    overcommitRatio: 1.2,
    preemptionPolicy: 'low-priority'
  },

  errorHandling: {
    retryAttempts: 3,
    retryDelay: 1000,
    failureThreshold: 5,
    circuitBreaker: {
      enabled: true,
      threshold: 5,
      timeout: 30000
    }
  }
};

// Utility functions
export function getAgentConfig(
  type: AgentType
): AgentTypeConfig {
  return defaultAgentConfig.agents[type];
}

export function validateAgentCapabilities(
  type: AgentType,
  intent: AnalysisIntent
): boolean {
  const config = getAgentConfig(type);
  return config.capabilities.some(cap => cap.intent === intent);
}

export function checkResourceAvailability(
    type: AgentType,
    resources: Partial<ResourceRequirements>
  ): boolean {
    const config = defaultAgentConfig.agents[type];
    
    if (resources.cpu) {
      if (resources.cpu.target > config.resources.cpu.max ||
          resources.cpu.min < config.resources.cpu.min) {
        return false;
      }
    }
    
    if (resources.memory) {
      if (resources.memory.target > config.resources.memory.max ||
          resources.memory.min < config.resources.memory.min) {
        return false;
      }
    }
  
    return true;
  }
  
  export function getAgentStatus(
    type: AgentType
  ): AgentStatus {
    // Implementation of agent status retrieval
    return 'idle';
  }
  
  export function getAgentMetrics(
    type: AgentType
  ): Record<string, number> {
    // Implementation of agent metrics retrieval
    return {
      requestsProcessed: 0,
      errorCount: 0,
      avgProcessingTime: 0
    };
  }
  
  export function shouldFailover(
    type: AgentType,
    metrics: Record<string, number>
  ): boolean {
    const config = defaultAgentConfig.agents[type];
    const fallback = config.fallback;
  
    if (!fallback.enabled) {
      return false;
    }
  
    const { triggers } = fallback;
    
    // Check against configured thresholds
    if (metrics.errorRate > triggers.errorThreshold ||
        metrics.memory > triggers.memoryThreshold ||
        metrics.cpu > triggers.cpuThreshold) {
      return true;
    }
  
    return false;
  }
  
  export function canHandleIntent(
    type: AgentType,
    intent: AnalysisIntent
  ): boolean {
    const config = defaultAgentConfig.agents[type];
    return config.capabilities.some(cap => cap.intent === intent);
  }
  
  export function distributeWorkload(
    agents: Record<AgentType, number>,
    workload: Record<AnalysisIntent, number>
  ): Record<AgentType, AnalysisIntent[]> {
    // Implementation of workload distribution
    return {
      router: [],
      siteAnalysis: [],
      customerInsights: [],
      marketAnalysis: [],
      visualization: []
    };
  }
  
  export function validateAgentState(
    type: AgentType,
    state: Record<string, any>
  ): boolean {
    const config = defaultAgentConfig.agents[type];
    
    // Validate resource state
    if (state.cpu > config.resources.cpu.max ||
        state.memory > config.resources.memory.max) {
      return false;
    }
  
    // Validate capabilities
    if (!config.capabilities.some(cap => 
        state.capabilities.includes(cap.intent))) {
      return false;
    }
  
    return true;
  }
  
  export function getOptimalAgentCount(
    type: AgentType,
    metrics: Record<string, number>
  ): number {
    const config = defaultAgentConfig.agents[type];
    const { scaling } = config;
  
    // Calculate based on current metrics and scaling config
    let optimal = Math.ceil(
      metrics.requestRate / (metrics.processingCapacity * scaling.targetCpuUtilization)
    );
  
    // Bound by min/max settings
    optimal = Math.max(optimal, scaling.min);
    optimal = Math.min(optimal, scaling.max);
  
    return optimal;
  }
  
  export function getAvailableResources(
    type: AgentType
  ): ResourceRequirements {
    const config = defaultAgentConfig.agents[type];
    return config.resources;
  }
  
  export function validateCommunicationConfig(
    type: AgentType,
    commConfig: CommunicationConfig
  ): boolean {
    const config = defaultAgentConfig.agents[type];
    
    if (commConfig.timeout > config.communication.timeout ||
        commConfig.queueSize > config.communication.queueSize) {
      return false;
    }
  
    return true;
  }
  
  export function shouldRebalanceAgents(): boolean {
    // Implementation of rebalancing decision logic
    return false;
  }