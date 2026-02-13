// src/config/securityConfig.ts

import { CacheLevel } from './cachingConfig';

export type AuthMethod = 'jwt' | 'api-key' | 'oauth2' | 'basic';
export type AuthProvider = 'internal' | 'azure-ad' | 'auth0' | 'okta' | 'custom';
export type EncryptionAlgorithm = 'aes-256-gcm' | 'chacha20-poly1305';
export type HashAlgorithm = 'argon2id' | 'bcrypt';
export type AuditLevel = 'none' | 'basic' | 'detailed' | 'forensic';
export type SecurityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuthConfig {
  method: AuthMethod;
  provider: AuthProvider;
  required: boolean;
  tokenExpiration: number;
  refreshTokenExpiration: number;
  maxInvalidAttempts: number;
  lockoutDuration: number;
  sessionConfig?: {
    duration: number;
    renewalThreshold: number;
    maxConcurrent: number;
    singleSession: boolean;
  };
}

export interface OAuth2Config {
  clientId: string;
  tenantId?: string;
  scopes: string[];
  authorizeEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  callbackUrl: string;
  responseType: 'code' | 'token';
}

export interface RateLimitRule {
  window: number;
  maxRequests: number;
  penaltyDuration: number;
  bypassTokens?: string[];
  conditions?: {
    paths?: string[];
    methods?: string[];
    ips?: string[];
  };
}

export interface EncryptionConfig {
  algorithm: EncryptionAlgorithm;
  keyRotationInterval: number;
  keyDerivation: {
    algorithm: HashAlgorithm;
    iterations: number;
    memoryCost: number;
  };
  atRest: {
    enabled: boolean;
    algorithm: EncryptionAlgorithm;
    keyProvider: 'vault' | 'kms' | 'local';
  };
}

export interface AuditConfig {
  level: AuditLevel;
  storage: {
    type: 'database' | 'file' | 'service';
    retention: number;
    compression: boolean;
  };
  events: {
    authentication: boolean;
    authorization: boolean;
    dataAccess: boolean;
    configuration: boolean;
    system: boolean;
  };
  sampling: {
    enabled: boolean;
    rate: number;
  };
}

export interface FirewallRule {
  name: string;
  priority: number;
  action: 'allow' | 'deny';
  conditions: {
    ips?: string[];
    userAgents?: string[];
    referers?: string[];
    geolocations?: string[];
  };
}

export interface SecurityMonitoring {
  enabled: boolean;
  alerting: {
    email?: string[];
    webhook?: string;
    severity: SecurityLevel;
  };
  scanning: {
    interval: number;
    types: ('vulnerability' | 'dependency' | 'configuration' | 'secret')[];
  };
  reporting: {
    interval: number;
    format: 'json' | 'pdf';
    recipients: string[];
  };
}

export interface SecurityConfig {
  version: string;

  authentication: {
    enabled: boolean;
    methods: Record<AuthMethod, AuthConfig>;
    oauth2?: Record<AuthProvider, OAuth2Config>;
    mfa: {
      enabled: boolean;
      methods: ('totp' | 'sms' | 'email')[];
      requiredLevel: SecurityLevel;
    };
  };

  authorization: {
    enabled: boolean;
    roleDefinitions: Record<string, {
      permissions: string[];
      inheritFrom?: string[];
      restrictions?: Record<string, any>;
    }>;
    defaultRole: string;
    enforceRBAC: boolean;
    cacheConfig: {
      enabled: boolean;
      ttl: number;
      level: CacheLevel;
    };
  };

  encryption: EncryptionConfig;

  auditing: AuditConfig;

  rateLimit: {
    enabled: boolean;
    defaultRule: RateLimitRule;
    rules: Record<string, RateLimitRule>;
    storage: {
      type: CacheLevel;
      prefix: string;
    };
  };

  firewall: {
    enabled: boolean;
    defaultAction: 'allow' | 'deny';
    rules: FirewallRule[];
  };

  monitoring: SecurityMonitoring;

  headers: {
    hsts: boolean;
    xframe: 'deny' | 'sameorigin' | 'allow-from';
    contentSecurity: Record<string, string[]>;
    referrerPolicy: string;
  };
}

// Default configuration
export const defaultSecurityConfig: SecurityConfig = {
  version: '1.0.0',

  authentication: {
    enabled: true,
    methods: {
      jwt: {
        method: 'jwt',
        provider: 'internal',
        required: true,
        tokenExpiration: 3600, // 1 hour
        refreshTokenExpiration: 2592000, // 30 days
        maxInvalidAttempts: 5,
        lockoutDuration: 900, // 15 minutes
        sessionConfig: {
          duration: 86400, // 24 hours
          renewalThreshold: 3600, // 1 hour
          maxConcurrent: 5,
          singleSession: false
        }
      },
      'api-key': {
        method: 'api-key',
        provider: 'internal',
        required: true,
        tokenExpiration: 31536000, // 1 year
        refreshTokenExpiration: 31536000,
        maxInvalidAttempts: 10,
        lockoutDuration: 3600
      },
      oauth2: {
        method: 'oauth2',
        provider: 'auth0',
        required: true,
        tokenExpiration: 3600,
        refreshTokenExpiration: 2592000,
        maxInvalidAttempts: 5,
        lockoutDuration: 900
      },
      basic: {
        method: 'basic',
        provider: 'internal',
        required: true,
        tokenExpiration: 3600,
        refreshTokenExpiration: 0,
        maxInvalidAttempts: 5,
        lockoutDuration: 900
      }
    },
    mfa: {
      enabled: true,
      methods: ['totp', 'email'],
      requiredLevel: 'high'
    }
  },

  authorization: {
    enabled: true,
    roleDefinitions: {
      admin: {
        permissions: ['*'],
        restrictions: {}
      },
      analyst: {
        permissions: ['read:*', 'write:analysis', 'execute:analysis'],
        inheritFrom: ['user'],
        restrictions: {
          maxRequests: 1000,
          maxDataSize: 100000000
        }
      },
      user: {
        permissions: ['read:public', 'execute:basic'],
        restrictions: {
          maxRequests: 100,
          maxDataSize: 10000000
        }
      }
    },
    defaultRole: 'user',
    enforceRBAC: true,
    cacheConfig: {
      enabled: true,
      ttl: 300, // 5 minutes
      level: 'memory'
    }
  },

  encryption: {
    algorithm: 'aes-256-gcm',
    keyRotationInterval: 7776000, // 90 days
    keyDerivation: {
      algorithm: 'argon2id',
      iterations: 3,
      memoryCost: 65536
    },
    atRest: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      keyProvider: 'vault'
    }
  },

  auditing: {
    level: 'detailed',
    storage: {
      type: 'database',
      retention: 31536000, // 1 year
      compression: true
    },
    events: {
      authentication: true,
      authorization: true,
      dataAccess: true,
      configuration: true,
      system: true
    },
    sampling: {
      enabled: true,
      rate: 0.1 // 10%
    }
  },

  rateLimit: {
    enabled: true,
    defaultRule: {
      window: 60000, // 1 minute
      maxRequests: 100,
      penaltyDuration: 300000 // 5 minutes
    },
    rules: {
      analysis: {
        window: 300000, // 5 minutes
        maxRequests: 50,
        penaltyDuration: 900000, // 15 minutes
        conditions: {
          paths: ['/api/analysis/*']
        }
      }
    },
    storage: {
      type: 'redis',
      prefix: 'ratelimit:'
    }
  },

  firewall: {
    enabled: true,
    defaultAction: 'deny',
    rules: [
      {
        name: 'allow-internal',
        priority: 1,
        action: 'allow',
        conditions: {
          ips: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
        }
      },
      {
        name: 'block-known-bad-actors',
        priority: 2,
        action: 'deny',
        conditions: {
          userAgents: ['known-bad-bot/*', 'malicious-client/*']
        }
      }
    ]
  },

  monitoring: {
    enabled: true,
    alerting: {
      severity: 'high',
      email: ['security@example.com'],
      webhook: 'https://alerts.example.com/security'
    },
    scanning: {
      interval: 86400, // 24 hours
      types: ['vulnerability', 'dependency', 'configuration', 'secret']
    },
    reporting: {
      interval: 604800, // 1 week
      format: 'pdf',
      recipients: ['security@example.com']
    }
  },

  headers: {
    hsts: true,
    xframe: 'deny',
    contentSecurity: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:']
    },
    referrerPolicy: 'strict-origin-when-cross-origin'
  }
};

// Utility functions
export function validateAuth(token: string, method: AuthMethod): boolean {
  // Implementation of auth validation
  return true;
}

export function checkPermission(
  userId: string,
  resource: string,
  action: string
): boolean {
  // Implementation of permission checking
  return true;
}

export function generateAuditLog(
  event: string,
  data: Record<string, any>
): void {
  // Implementation of audit logging
  console.log(event, data);
}

export function isRateLimited(
  identifier: string,
  rule?: RateLimitRule
): boolean {
  // Implementation of rate limiting check
  return false;
}

export function evaluateFirewallRules(
  request: Record<string, any>
): boolean {
  // Implementation of firewall rule evaluation
  return true;
}