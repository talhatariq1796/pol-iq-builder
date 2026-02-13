// src/config/registry/ConfigRegistry.ts

import { EventEmitter } from 'events';

// Configuration Types
type ConfigKey = string;
type ConfigValue = any;
type ConfigValidator = (value: ConfigValue) => boolean;
type ConfigEnvironment = 'development' | 'staging' | 'production';

interface ConfigMetadata {
  version: string;
  lastUpdated: Date;
  environment: ConfigEnvironment;
  validators: ConfigValidator[];
}

interface ConfigEntry {
  value: ConfigValue;
  metadata: ConfigMetadata;
}

class ConfigRegistry {
  private static instance: ConfigRegistry;
  private configs: Map<ConfigKey, ConfigEntry>;
  private eventEmitter: EventEmitter;

  private constructor() {
    this.configs = new Map();
    this.eventEmitter = new EventEmitter();
  }

  public static getInstance(): ConfigRegistry {
    if (!ConfigRegistry.instance) {
      ConfigRegistry.instance = new ConfigRegistry();
    }
    return ConfigRegistry.instance;
  }

  // Register a new configuration with validators
  public register(
    key: ConfigKey,
    value: ConfigValue,
    environment: ConfigEnvironment,
    validators: ConfigValidator[] = []
  ): void {
    const metadata: ConfigMetadata = {
      version: '1.0.0',
      lastUpdated: new Date(),
      environment,
      validators,
    };

    // Validate before registering
    if (!this.validateConfig(value, validators)) {
      throw new Error(`Configuration validation failed for key: ${key}`);
    }

    this.configs.set(key, { value, metadata });
    this.eventEmitter.emit('configUpdated', key);
  }

  // Get configuration value
  public get<T>(key: ConfigKey): T {
    const entry = this.configs.get(key);
    if (!entry) {
      throw new Error(`Configuration not found for key: ${key}`);
    }
    return entry.value as T;
  }

  // Update existing configuration
  public update(
    key: ConfigKey,
    value: ConfigValue,
    version?: string
  ): void {
    const entry = this.configs.get(key);
    if (!entry) {
      throw new Error(`Configuration not found for key: ${key}`);
    }

    // Validate before updating
    if (!this.validateConfig(value, entry.metadata.validators)) {
      throw new Error(`Configuration validation failed for key: ${key}`);
    }

    const updatedMetadata: ConfigMetadata = {
      ...entry.metadata,
      version: version || entry.metadata.version,
      lastUpdated: new Date(),
    };

    this.configs.set(key, { value, metadata: updatedMetadata });
    this.eventEmitter.emit('configUpdated', key);
  }

  // Subscribe to configuration changes
  public subscribe(key: ConfigKey, callback: (value: ConfigValue) => void): void {
    this.eventEmitter.on('configUpdated', (updatedKey: string) => {
      if (updatedKey === key) {
        const entry = this.configs.get(key);
        if (entry) {
          callback(entry.value);
        }
      }
    });
  }

  // Validate configuration against registered validators
  private validateConfig(value: ConfigValue, validators: ConfigValidator[]): boolean {
    return validators.every(validator => validator(value));
  }

  // Get configuration metadata
  public getMetadata(key: ConfigKey): ConfigMetadata {
    const entry = this.configs.get(key);
    if (!entry) {
      throw new Error(`Configuration not found for key: ${key}`);
    }
    return entry.metadata;
  }

  // Environment-specific configuration override
  public registerEnvironmentOverride(
    key: ConfigKey,
    value: ConfigValue,
    environment: ConfigEnvironment
  ): void {
    const entry = this.configs.get(key);
    if (!entry) {
      throw new Error(`Configuration not found for key: ${key}`);
    }

    if (entry.metadata.environment === environment) {
      this.update(key, value);
    }
  }

  // Hot reload configuration from source
  public async hotReload(key: ConfigKey): Promise<void> {
    // Implement configuration reloading logic here
    // This could involve reading from files, environment variables, or remote sources
    this.eventEmitter.emit('configReloading', key);
    
    try {
      // Placeholder for actual reload logic
      const entry = this.configs.get(key);
      if (entry) {
        // Simulate reload by updating timestamp
        this.update(key, entry.value);
      }
      
      this.eventEmitter.emit('configReloaded', key);
    } catch (error) {
      this.eventEmitter.emit('configReloadError', { key, error });
      throw error;
    }
  }
}

export default ConfigRegistry;