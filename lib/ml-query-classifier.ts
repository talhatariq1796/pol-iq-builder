import { VisualizationType } from "../reference/dynamic-layers";

/**
 * Interface for ML prediction result
 */
export interface MLPrediction {
  type: VisualizationType;
  confidence: number;
  alternatives?: Array<{
    type: VisualizationType;
    confidence: number;
  }>;
  source?: 'ml'; // For transparency
}

/**
 * Configuration options for the ML classifier
 */
export interface MLClassifierConfig {
  apiEndpoint?: string;
  confidenceThreshold?: number;
  cacheTimeout?: number;
  timeoutMs?: number;
}

/**
 * Cache entry for ML predictions
 */
interface CacheEntry {
  prediction: MLPrediction;
  timestamp: number;
}

/**
 * ML Query Classifier using the Vercel serverless function
 * This class provides machine learning-based classification of queries
 * with a fallback to pattern matching if needed
 */
export class MLQueryClassifier {
  private apiEndpoint: string;
  private confidenceThreshold: number;
  private cacheTimeout: number;
  private timeoutMs: number;
  private predictionCache: Map<string, CacheEntry> = new Map();
  
  /**
   * Create a new ML Query Classifier
   * @param config Configuration options
   */
  constructor(config: MLClassifierConfig = {}) {
    this.apiEndpoint = config.apiEndpoint || '/api/classify-query';
    this.confidenceThreshold = config.confidenceThreshold || 0.7;
    this.cacheTimeout = config.cacheTimeout || 30 * 60 * 1000; // 30 minutes
    this.timeoutMs = config.timeoutMs || 1000; // 1 second timeout
  }
  
  /**
   * Classify a query using the ML service (primary classifier).
   * @param query The query to classify
   * @param context (Optional) Context for future contextual chat
   * @returns Promise with prediction or null if error/timeout
   */
  async classifyQuery(query: string, context?: any): Promise<MLPrediction | null> {
    if (!query) return null;
    // Context is currently unused, but reserved for future contextual chat
    
    // Check cache first
    const cachedResult = this.getCachedPrediction(query);
    if (cachedResult) {
      console.log('Using cached ML prediction for query:', query);
      return cachedResult;
    }
    
    try {
      // Set up timeout for the fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
      
      // Call the ML service
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const prediction = await response.json();
      
      // Cache the result
      this.cachePrediction(query, prediction);
      
      return prediction;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('ML service request timed out for query:', query);
      } else {
        console.warn('Error calling ML service:', error);
      }
      return null;
    }
  }
  
  /**
   * Check if an ML prediction has sufficient confidence
   * @param prediction The ML prediction
   * @returns True if the prediction is confident enough
   */
  isConfident(prediction: MLPrediction | null): boolean {
    return !!(prediction && prediction.confidence >= this.confidenceThreshold);
  }
  
  /**
   * Get cached prediction if available and not expired
   * @param query The query to look up
   * @returns The cached prediction or null
   */
  private getCachedPrediction(query: string): MLPrediction | null {
    const normalizedQuery = this.normalizeQuery(query);
    const cached = this.predictionCache.get(normalizedQuery);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.prediction;
    }
    
    return null;
  }
  
  /**
   * Cache a prediction for future use
   * @param query The query
   * @param prediction The prediction to cache
   */
  private cachePrediction(query: string, prediction: MLPrediction): void {
    const normalizedQuery = this.normalizeQuery(query);
    this.predictionCache.set(normalizedQuery, {
      prediction,
      timestamp: Date.now()
    });
    
    // Manage cache size - keep it under 100 entries
    if (this.predictionCache.size > 100) {
      // Delete oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      
      Array.from(this.predictionCache.entries()).forEach(([key, entry]) => {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      });
      
      if (oldestKey) {
        this.predictionCache.delete(oldestKey);
      }
    }
  }
  
  /**
   * Normalize a query for caching
   * (removes extra spaces, converts to lowercase)
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  /**
   * Clear the prediction cache
   */
  clearCache(): void {
    this.predictionCache.clear();
  }
  
  /**
   * Update configuration options
   * @param config New configuration options
   */
  updateConfig(config: Partial<MLClassifierConfig>): void {
    if (config.apiEndpoint !== undefined) {
      this.apiEndpoint = config.apiEndpoint;
    }
    
    if (config.confidenceThreshold !== undefined) {
      this.confidenceThreshold = config.confidenceThreshold;
    }
    
    if (config.cacheTimeout !== undefined) {
      this.cacheTimeout = config.cacheTimeout;
    }
    
    if (config.timeoutMs !== undefined) {
      this.timeoutMs = config.timeoutMs;
    }
  }
}

// DOCUMENTATION:
// - MLQueryClassifier is now the primary classifier in the new flow.
// - Accepts context parameter for future contextual chat (currently ignored).
// - MLPrediction includes a 'source' field for transparency. 