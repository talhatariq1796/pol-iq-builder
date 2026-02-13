// src/config/validation/validators.ts

import { z } from 'zod';

// Common Types
export interface BaseConfig {
  enabled: boolean;
  version: string;
  description?: string;
}

// Processing Configuration Validator
export const ProcessingConfigSchema = z.object({
  ...z.object({
    enabled: z.boolean(),
    version: z.string(),
    description: z.string().optional(),
  }).shape,
  batchSize: z.number().min(1).max(1000),
  concurrentProcesses: z.number().min(1).max(100),
  timeout: z.number().min(1000),
  retryAttempts: z.number().min(0).max(5),
  cacheStrategy: z.enum(['memory', 'redis', 'hybrid']),
  queuePriority: z.enum(['low', 'medium', 'high']),
});

// Caching Configuration Validator
export const CachingConfigSchema = z.object({
  ...z.object({
    enabled: z.boolean(),
    version: z.string(),
    description: z.string().optional(),
  }).shape,
  strategy: z.enum(['memory', 'redis', 'hybrid']),
  ttl: z.number().min(0),
  maxSize: z.number().min(1),
  compression: z.boolean(),
  prefetchEnabled: z.boolean(),
  invalidationRules: z.array(z.object({
    pattern: z.string(),
    action: z.enum(['clear', 'update']),
  })),
});

// Monitoring Configuration Validator
export const MonitoringConfigSchema = z.object({
  ...z.object({
    enabled: z.boolean(),
    version: z.string(),
    description: z.string().optional(),
  }).shape,
  metricsInterval: z.number().min(1000),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
  alertThresholds: z.object({
    cpu: z.number().min(0).max(100),
    memory: z.number().min(0).max(100),
    latency: z.number().min(0),
  }),
  retention: z.object({
    metrics: z.number().min(1),
    logs: z.number().min(1),
  }),
});

// Feature Service Configuration Validator
export const FeatureServiceConfigSchema = z.object({
  ...z.object({
    enabled: z.boolean(),
    version: z.string(),
    description: z.string().optional(),
  }).shape,
  endpoint: z.string().url(),
  maxConnections: z.number().min(1),
  timeout: z.number().min(1000),
  retryPolicy: z.object({
    attempts: z.number().min(0),
    backoff: z.enum(['linear', 'exponential']),
  }),
  transformations: z.array(z.object({
    field: z.string(),
    operation: z.enum(['round', 'truncate', 'format']),
  })),
});

// Configuration Source Adapters
export abstract class ConfigSourceAdapter {
  abstract read(key: string): Promise<any>;
  abstract write(key: string, value: any): Promise<void>;
  abstract watch(key: string, callback: (value: any) => void): void;
}

// File System Config Source
export class FileConfigSource extends ConfigSourceAdapter {
  private basePath: string;

  constructor(basePath: string) {
    super();
    this.basePath = basePath;
  }

  async read(key: string): Promise<any> {
    try {
      const filePath = `${this.basePath}/${key}.json`;
      const fileContent = await window.fs.readFile(filePath, { encoding: 'utf8' });
      return JSON.parse(fileContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read config from file: ${message}`);
    }
  }

  async write(key: string, value: any): Promise<void> {
    try {
      const filePath = `${this.basePath}/${key}.json`;
      const content = JSON.stringify(value, null, 2);
      await window.fs.writeFile(filePath, content, { encoding: 'utf8' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to write config to file: ${message}`);
    }
  }

  watch(key: string, callback: (value: any) => void): void {
    setInterval(async () => {
      try {
        const value = await this.read(key);
        callback(value);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error watching config file: ${message}`);
      }
    }, 5000);
  }
}

// Environment Variables Config Source
export class EnvConfigSource extends ConfigSourceAdapter {
  private prefix: string;

  constructor(prefix: string = 'GIS_') {
    super();
    this.prefix = prefix;
  }

  async read(key: string): Promise<any> {
    const envKey = `${this.prefix}${key.toUpperCase()}`;
    const value = process.env[envKey];
    if (!value) {
      throw new Error(`Environment variable ${envKey} not found`);
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async write(): Promise<void> {
    throw new Error('Environment variables are read-only');
  }

  watch(key: string, callback: (value: any) => void): void {
    // Environment variables don't support watching
    throw new Error('Environment variables do not support watching');
  }
}

// Remote Config Source (e.g., Redis, etcd)
export class RemoteConfigSource extends ConfigSourceAdapter {
  private client: any; // Redis or etcd client
  private options: any;

  constructor(options: any) {
    super();
    this.options = options;
    // Initialize client connection
  }

  async read(key: string): Promise<any> {
    try {
      const value = await this.client.get(key);
      return JSON.parse(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read from remote config: ${message}`);
    }
  }

  async write(key: string, value: any): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to write to remote config: ${message}`);
    }
  }

  watch(key: string, callback: (value: any) => void): void {
    // Implement remote config watching mechanism
    this.client.watch(key, (newValue: string) => {
      try {
        callback(JSON.parse(newValue));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error watching remote config: ${message}`);
      }
    });
  }
}

// Configuration Source Factory
export class ConfigSourceFactory {
  static createSource(type: 'file' | 'env' | 'remote', options?: any): ConfigSourceAdapter {
    switch (type) {
      case 'file':
        return new FileConfigSource(options?.basePath || './config');
      case 'env':
        return new EnvConfigSource(options?.prefix);
      case 'remote':
        return new RemoteConfigSource(options);
      default:
        throw new Error(`Unsupported config source type: ${type}`);
    }
  }
}

// Add type for window.fs
declare global {
  interface Window {
    fs: {
      readFile: (path: string, options: { encoding: string }) => Promise<string>;
      writeFile: (path: string, data: string, options: { encoding: string }) => Promise<void>;
    }
  }
}