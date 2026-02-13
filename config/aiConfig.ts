// src/config/aiConfig.ts

import { ProcessingStrategy } from './processingConfig';
import { ValidationRule } from './coreConfig';
import { ErrorResponse } from './errorConfig';

export type AnalysisIntent = 
  | 'CONCENTRATION' 
  | 'COMPARISON'
  | 'TRENDS'
  | 'PROXIMITY';

export type VisualizationType = 'heatmap' | 'choropleth' | 'point';
export type AggregationType = 'avg' | 'sum' | 'count' | 'max' | 'min' | 'weighted_sum' | 'normalized' | 'trend';

export type ModelProvider = 'openai' | 'anthropic' | 'cohere' | 'azure';
export type ModelType = 'completion' | 'chat' | 'embedding';

export interface AnalysisMetric {
  field: string;
  name: string;
  description: string;
  format?: (value: number) => string;
  aggregation: AggregationType;
  validation?: ValidationRule[];
}

export interface LayerVisualization {
  type: VisualizationType;
  color?: number[];
  opacity?: number;
  validation?: ValidationRule[];
}

export interface ModelConfig {
  provider: ModelProvider;
  type: ModelType;
  modelId: string;
  version?: string;
  parameters: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
  };
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  timeout: number;
  retryConfig: {
    maxAttempts: number;
    backoffMs: number;
  };
}

export interface LayerAnalysisConfig {
  title: string;
  url: string;
  patterns?: string[];
  metrics: Record<string, AnalysisMetric>;
  visualization?: LayerVisualization;
  validation?: ValidationRule[];
  caching?: {
    enabled: boolean;
    ttl: number;
  };
}

export interface IntentConfig {
  defaultMetrics: string[];
  patterns: string[];
  aggregation: AggregationType;
  validation?: ValidationRule[];
  processingStrategy?: ProcessingStrategy;
  models?: ModelConfig[];
  errorHandling?: {
    fallbackResponses: Record<string, ErrorResponse>;
    recoveryStrategies: Record<string, ProcessingStrategy>;
  };
}

export interface ResponseTemplate {
  (data: Record<string, any>): string;
  validation?: ValidationRule[];
}

export interface AIConfig {
  version: string;
  
  defaultModel: ModelConfig;
  models: Record<ModelProvider, ModelConfig[]>;
  
  analysis: {
    confidenceThreshold: number;
    minSegmentValue: number;
    minOpportunityPotential: number;
    validation?: ValidationRule[];
  };
  
  processing: {
    cacheEnabled: boolean;
    cacheDuration: number;
    parallelProcessing: boolean;
    useHybridProcessing: boolean;
    aiEnhancementThreshold: number;
    validation?: ValidationRule[];
  };
  
  spatial: {
    searchRadius: number;
    maxResults: number;
    competitorRadius?: number;
    validation?: ValidationRule[];
  };
  
  layers: Record<string, LayerAnalysisConfig>;
  intentAnalysis: Record<AnalysisIntent, IntentConfig>;
  responseTemplates: Record<AnalysisIntent, ResponseTemplate>;
  
  monitoring: {
    enabled: boolean;
    sampleRate: number;
    metricPrefix: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };

  defaultConfidenceThreshold: number;
  confidenceThreshold: number;
}

// Default OpenAI GPT-4 model configuration
const defaultGPT4Config: ModelConfig = {
  provider: 'openai',
  type: 'chat',
  modelId: 'gpt-4',
  parameters: {
    maxTokens: 2000,
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0
  },
  rateLimit: {
    maxRequests: 200,
    windowMs: 60000 // 1 minute
  },
  timeout: 30000,
  retryConfig: {
    maxAttempts: 3,
    backoffMs: 1000
  }
};

// Default configuration
export const defaultAIConfig: AIConfig = {
  version: '2.0.0',
  
  defaultModel: defaultGPT4Config,
  
  models: {
    openai: [
      defaultGPT4Config,
      {
        ...defaultGPT4Config,
        modelId: 'gpt-3.5-turbo',
        parameters: {
          ...defaultGPT4Config.parameters,
          maxTokens: 1000
        }
      }
    ],
    anthropic: [
      {
        provider: 'anthropic',
        type: 'chat',
        modelId: 'claude-3',
        parameters: {
          maxTokens: 2000,
          temperature: 0.7
        },
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000
        },
        timeout: 30000,
        retryConfig: {
          maxAttempts: 3,
          backoffMs: 1000
        }
      }
    ],
    cohere: [],
    azure: []
  },
  
  analysis: {
    confidenceThreshold: 0.7,
    minSegmentValue: 1000,
    minOpportunityPotential: 0.5,
    validation: [
      {
        field: 'confidenceThreshold',
        type: 'range',
        severity: 'error',
        message: 'Confidence threshold must be between 0 and 1',
        params: { min: 0, max: 1 }
      }
    ]
  },
  
  processing: {
    cacheEnabled: true,
    cacheDuration: 300000, // 5 minutes
    parallelProcessing: true,
    useHybridProcessing: true,
    aiEnhancementThreshold: 0.8
  },
  
  spatial: {
    searchRadius: 5000, // 5km
    maxResults: 100,
    competitorRadius: 2000 // 2km
  },
  
  layers: {
    // Moved to specific implementation configs
  },
  
  intentAnalysis: {
    CONCENTRATION: {
      defaultMetrics: ['density'],
      patterns: [
        'where are the most',
        'highest concentration',
        'clusters of',
        'areas with many'
      ],
      aggregation: 'weighted_sum',
      processingStrategy: 'traditional'
    },
    COMPARISON: {
      defaultMetrics: ['value', 'ratio'],
      patterns: [
        'compare',
        'difference between',
        'which area has more'
      ],
      aggregation: 'normalized',
      processingStrategy: 'hybrid'
    },
    TRENDS: {
      defaultMetrics: ['change', 'growth'],
      patterns: [
        'trend',
        'pattern',
        'over time',
        'historical'
      ],
      aggregation: 'trend',
      processingStrategy: 'ai'
    },
    PROXIMITY: {
      defaultMetrics: ['distance'],
      patterns: [
        'near',
        'closest',
        'within',
        'distance to'
      ],
      aggregation: 'min',
      processingStrategy: 'traditional'
    }
  },
  
  responseTemplates: {
    CONCENTRATION: (data) => `Analysis shows the highest concentration in ${data.location} with ${data.value}`,
    COMPARISON: (data) => `Comparing the areas: ${data.comparison}`,
    TRENDS: (data) => `The trend analysis shows: ${data.trend}`,
    PROXIMITY: (data) => `Found ${data.count} locations within ${data.distance} of the target`
  },
  
  monitoring: {
    enabled: true,
    sampleRate: 0.1,
    metricPrefix: 'ai_analysis',
    logLevel: 'info'
  },

  defaultConfidenceThreshold: 0.7,
  confidenceThreshold: 0.7
};

// Utility functions
export function getModelConfig(
  provider: ModelProvider,
  modelId: string
): ModelConfig | undefined {
  return defaultAIConfig.models[provider].find(m => m.modelId === modelId);
}

export function validateAnalysisRequest(
  intent: AnalysisIntent,
  params: Record<string, any>
): boolean {
  // Implementation of request validation
  return true;
}

export function shouldUseAI(
  intent: AnalysisIntent,
  complexity: number
): boolean {
  // Implementation of AI usage decision logic
  return true;
}