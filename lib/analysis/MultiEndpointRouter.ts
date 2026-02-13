/**
 * MultiEndpointRouter - Enhanced router for multi-endpoint analysis
 * 
 * Extends CachedEndpointRouter to support:
 * 1. Loading multiple endpoint datasets simultaneously
 * 2. Coordinating data across endpoints
 * 3. Optimizing multi-endpoint queries
 */

import { AnalysisOptions, RawAnalysisResult } from './types';
import { ConfigurationManager } from './ConfigurationManager';
import { CachedEndpointRouter } from './CachedEndpointRouter';
import { MultiEndpointQueryDetector, MultiEndpointQuery } from './MultiEndpointQueryDetector';

export interface MultiEndpointResult {
  primaryResult: RawAnalysisResult;
  secondaryResults: Record<string, RawAnalysisResult>;
  combinationStrategy: string;
  totalRecords: number;
  loadingStats: {
    totalLoadTime: number;
    endpointLoadTimes: Record<string, number>;
    cacheHits: string[];
    cacheMisses: string[];
  };
}

export class MultiEndpointRouter extends CachedEndpointRouter {
  private queryDetector: MultiEndpointQueryDetector;
  private loadingCache: Map<string, Promise<RawAnalysisResult>> = new Map();

  constructor(configManager: ConfigurationManager) {
    super(configManager);
    this.queryDetector = new MultiEndpointQueryDetector();
    console.log('[MultiEndpointRouter] Initialized with multi-endpoint support');
  }

  /**
   * Enhanced endpoint selection that considers multi-endpoint queries
   */
  async selectEndpoints(query: string, options?: AnalysisOptions): Promise<MultiEndpointQuery> {
    // If explicitly specified, use those endpoints
    if (options?.endpoints && options.endpoints.length > 1) {
      return {
        isMultiEndpoint: true,
        primaryEndpoint: options.endpoints[0],
        secondaryEndpoints: options.endpoints.slice(1),
        combinationStrategy: options.combinationStrategy || 'overlay',
        confidence: 1.0,
        reasoning: 'Explicitly specified multi-endpoint query'
      };
    }

    // Use detector to analyze query
    return this.queryDetector.analyzeQuery(query);
  }

  /**
   * Execute multi-endpoint analysis
   */
  async executeMultiEndpointAnalysis(
    query: string, 
    options?: AnalysisOptions
  ): Promise<MultiEndpointResult> {
    const startTime = Date.now();
    
    try {
      // Detect endpoints needed
      const endpointQuery = await this.selectEndpoints(query, options);
      
      if (!endpointQuery.isMultiEndpoint) {
        // Fallback to single endpoint
        const singleResult = await this.callEndpoint(endpointQuery.primaryEndpoint, query, options);
        return this.wrapSingleEndpointResult(singleResult, endpointQuery.primaryEndpoint, Date.now() - startTime);
      }

      console.log(`[MultiEndpointRouter] Executing multi-endpoint analysis:`, {
        primary: endpointQuery.primaryEndpoint,
        secondary: endpointQuery.secondaryEndpoints,
        strategy: endpointQuery.combinationStrategy
      });

      // Load all endpoints in parallel for optimal performance
      const allEndpoints = [endpointQuery.primaryEndpoint, ...endpointQuery.secondaryEndpoints];
      const loadingStats = {
        totalLoadTime: 0,
        endpointLoadTimes: {} as Record<string, number>,
        cacheHits: [] as string[],
        cacheMisses: [] as string[]
      };

      // Execute parallel loading with individual timing
      const endpointResults = await this.loadEndpointsInParallel(
        allEndpoints, 
        query, 
        options,
        loadingStats
      );

      // Extract primary and secondary results
      const primaryResult = endpointResults[endpointQuery.primaryEndpoint];
      const secondaryResults = Object.fromEntries(
        endpointQuery.secondaryEndpoints.map(endpoint => [
          endpoint, 
          endpointResults[endpoint]
        ])
      );

      // Calculate total records across all endpoints
      const totalRecords = Object.values(endpointResults)
        .reduce((sum, result) => sum + (result.results?.length || 0), 0);

      loadingStats.totalLoadTime = Date.now() - startTime;

      const result: MultiEndpointResult = {
        primaryResult,
        secondaryResults,
        combinationStrategy: endpointQuery.combinationStrategy,
        totalRecords,
        loadingStats
      };

      console.log(`[MultiEndpointRouter] Multi-endpoint analysis complete:`, {
        endpoints: allEndpoints.length,
        totalRecords,
        loadTime: loadingStats.totalLoadTime
      });

      return result;

    } catch (error) {
      console.error(`[MultiEndpointRouter] Multi-endpoint analysis failed:`, error);
      
      // Fallback to primary endpoint only
      const fallbackEndpoint = await this.selectEndpoint(query, options);
      const fallbackResult = await this.callEndpoint(fallbackEndpoint, query, options);
      
      return this.wrapSingleEndpointResult(fallbackResult, fallbackEndpoint, Date.now() - startTime);
    }
  }

  /**
   * Load multiple endpoints in parallel with performance optimization
   */
  private async loadEndpointsInParallel(
    endpoints: string[],
    query: string,
    options?: AnalysisOptions,
    loadingStats?: any
  ): Promise<Record<string, RawAnalysisResult>> {
    
    // Create loading promises for all endpoints
    const loadingPromises = endpoints.map(async (endpoint) => {
      const endpointStartTime = Date.now();
      
      try {
        // Check if already loading this endpoint
        const cacheKey = `${endpoint}-${query}`;
        if (this.loadingCache.has(cacheKey)) {
          console.log(`[MultiEndpointRouter] Reusing loading promise for ${endpoint}`);
          const result = await this.loadingCache.get(cacheKey)!;
          
          if (loadingStats) {
            loadingStats.cacheHits.push(endpoint);
            loadingStats.endpointLoadTimes[endpoint] = Date.now() - endpointStartTime;
          }
          
          return { endpoint, result };
        }

        // Start new loading
        const loadingPromise = this.callEndpoint(endpoint, query, options);
        this.loadingCache.set(cacheKey, loadingPromise);

        const result = await loadingPromise;
        
        // Clean up cache after successful load
        this.loadingCache.delete(cacheKey);

        if (loadingStats) {
          loadingStats.cacheMisses.push(endpoint);
          loadingStats.endpointLoadTimes[endpoint] = Date.now() - endpointStartTime;
        }

        console.log(`[MultiEndpointRouter] Loaded ${endpoint}: ${result.results?.length || 0} records`);
        return { endpoint, result };

      } catch (error) {
        console.error(`[MultiEndpointRouter] Failed to load ${endpoint}:`, error);
        
        // Clean up failed cache entry
        this.loadingCache.delete(`${endpoint}-${query}`);
        
        // Return empty result for failed endpoint
        return {
          endpoint,
          result: {
            success: false,
            results: [],
            error: `Failed to load ${endpoint}: ${error}`,
            total_records: 0
          }
        };
      }
    });

    // Wait for all endpoints to load
    const endpointResults = await Promise.all(loadingPromises);

    // Convert to record format
    return Object.fromEntries(
      endpointResults.map(({ endpoint, result }) => [endpoint, result])
    );
  }

  /**
   * Wrap single endpoint result in multi-endpoint format
   */
  private wrapSingleEndpointResult(
    result: RawAnalysisResult, 
    endpoint: string, 
    loadTime: number
  ): MultiEndpointResult {
    return {
      primaryResult: result,
      secondaryResults: {},
      combinationStrategy: 'single',
      totalRecords: result.results?.length || 0,
      loadingStats: {
        totalLoadTime: loadTime,
        endpointLoadTimes: { [endpoint]: loadTime },
        cacheHits: [],
        cacheMisses: [endpoint]
      }
    };
  }

  /**
   * Get optimal endpoint loading order based on query priority
   */
  private getOptimalLoadingOrder(endpoints: string[], query: string): string[] {
    // Priority weights for different endpoint types
    const priorityWeights: Record<string, number> = {
      '/analyze': 10,                    // Fastest, most general
      '/competitive-analysis': 9,        // High business value
      '/demographic-insights': 8,        // Foundation data
      '/spatial-clusters': 7,            // Geographic context
      '/predictive-modeling': 6,         // Complex analysis
      '/trend-analysis': 5,              // Time-series processing
      '/anomaly-detection': 4,           // Specialized detection
      '/outlier-detection': 4,           // Specialized detection
      '/feature-interactions': 3,        // Complex correlations
      '/sensitivity-analysis': 2,        // Advanced analysis
      '/comparative-analysis': 2,        // Heavy computation
      '/segment-profiling': 1            // Detailed segmentation
    };

    return endpoints.sort((a, b) => (priorityWeights[b] || 0) - (priorityWeights[a] || 0));
  }

  /**
   * Estimate loading time for endpoint combination
   */
  estimateLoadingTime(endpoints: string[]): number {
    // Base loading times (in ms) per endpoint
    const baseTimes: Record<string, number> = {
      '/analyze': 2000,
      '/competitive-analysis': 2500,
      '/demographic-insights': 3000,
      '/spatial-clusters': 4000,
      '/predictive-modeling': 5000,
      '/trend-analysis': 3500,
      '/anomaly-detection': 4500,
      '/outlier-detection': 3000,
      '/feature-interactions': 6000,
      '/sensitivity-analysis': 5500,
      '/comparative-analysis': 4000,
      '/segment-profiling': 3500
    };

    // Parallel loading means max time, not sum
    const maxTime = Math.max(...endpoints.map(ep => baseTimes[ep] || 3000));
    
    // Add overhead for multi-endpoint coordination (10-20%)
    const overhead = endpoints.length > 1 ? maxTime * 0.15 : 0;
    
    return maxTime + overhead;
  }

  /**
   * Validate multi-endpoint combination
   */
  validateEndpointCombination(endpoints: string[]): { valid: boolean; reason?: string } {
    // Check for conflicting endpoints
    const conflicts = this.queryDetector.validateCombination(endpoints);
    if (!conflicts) {
      return { valid: false, reason: 'Conflicting endpoints detected' };
    }

    // Check resource limits
    if (endpoints.length > 4) {
      return { valid: false, reason: 'Too many endpoints - maximum 4 allowed' };
    }

    // Estimate memory usage
    const estimatedMemory = endpoints.length * 25; // ~25MB per endpoint file
    if (estimatedMemory > 150) { // Conservative browser limit
      return { valid: false, reason: 'Memory usage too high for browser' };
    }

    return { valid: true };
  }

  /**
   * Override parent method to use multi-endpoint logic
   */
  async selectEndpoint(query: string, options?: AnalysisOptions): Promise<string> {
    const multiQuery = await this.selectEndpoints(query, options);
    return multiQuery.primaryEndpoint;
  }
} 