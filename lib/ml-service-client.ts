import axios from 'axios';
import { VisualizationType } from "../reference/dynamic-layers";

/**
 * Configuration for the ML service client
 */
export interface MLServiceConfig {
  endpoint: string;
  apiKey?: string;
  timeout: number;
  retries: number;
}

/**
 * Parameters for a prediction request
 */
export interface PredictionParams {
  query: string;
  visualizationType: VisualizationType;
  layerData?: any;
  spatialConstraints?: any;
  temporalRange?: {
    start: string;
    end: string;
  };
}

/**
 * Response from the ML service
 */
export interface MLServiceResponse {
  predictions: any;
  explanations?: {
    shap_values: number[][];
    feature_names: string[];
    base_value: number;
  };
  processing_time: number;
  model_version: string;
  cached: boolean;
}

/**
 * Default configuration for the ML service
 */
const DEFAULT_CONFIG: MLServiceConfig = {
  endpoint: process.env.ML_SERVICE_ENDPOINT || 'http://localhost:5000/api/predict',
  apiKey: process.env.ML_SERVICE_API_KEY,
  timeout: 10000, // 10 seconds
  retries: 2
};

/**
 * Client for interacting with the ML service
 */
export class MLServiceClient {
  private config: MLServiceConfig;
  private cache: Map<string, { response: MLServiceResponse, timestamp: number }>;
  private readonly CACHE_TTL = 1000 * 60 * 15; // 15 minutes

  constructor(config: Partial<MLServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
  }

  /**
   * Executes a prediction request to the ML service
   */
  async predict(params: PredictionParams): Promise<MLServiceResponse> {
    const cacheKey = this.getCacheKey(params);
    const cachedItem = this.cache.get(cacheKey);
    
    // Return cached response if available and not expired
    if (cachedItem && (Date.now() - cachedItem.timestamp) < this.CACHE_TTL) {
      return { ...cachedItem.response, cached: true };
    }
    
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries <= this.config.retries) {
      try {
        const response = await axios.post(this.config.endpoint, params, {
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'x-api-key': this.config.apiKey })
          },
          timeout: this.config.timeout
        });
        
        const result: MLServiceResponse = response.data;
        
        // Cache the response
        this.cache.set(cacheKey, { 
          response: result, 
          timestamp: Date.now() 
        });
        
        return result;
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        if (retries <= this.config.retries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => 
            setTimeout(resolve, 1000 * Math.pow(2, retries - 1))
          );
        }
      }
    }
    
    throw lastError || new Error('Failed to get prediction from ML service');
  }
  
  /**
   * Generate a cache key from the prediction parameters
   */
  private getCacheKey(params: PredictionParams): string {
    return JSON.stringify({
      query: params.query,
      visualizationType: params.visualizationType,
      // Include only relevant parts of other parameters for caching
      ...(params.temporalRange && { 
        temporalRange: params.temporalRange 
      }),
      ...(params.spatialConstraints && { 
        spatialBounds: params.spatialConstraints.bounds 
      })
    });
  }
  
  /**
   * Clears the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
} 