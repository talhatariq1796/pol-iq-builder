import { LayerConfig } from '@/types/layers';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import * as query from '@arcgis/core/rest/query';
import Query from '@arcgis/core/rest/support/Query';
import { ClaudeAIAnalysisService } from '../../services/claude-service';
import { upload } from '@vercel/blob/client';
import Graphic from '@arcgis/core/Graphic';

interface QueryConfig {
  layerConfig: LayerConfig;
  sqlQuery: string;
}

interface QueryResult {
  featureSet: FeatureSet;
  analysis?: string;
}

interface CacheEntry {
  result: QueryResult;
  timestamp: number;
  expiresIn: number;
  metadata: {
    queryHash: string;
    lastAccessed: number;
    accessCount: number;
    dataVersion?: string;
  };
}

export class QueryService {
  private static instance: QueryService | null = null;
  private cache: Map<string, CacheEntry>;
  private batchSize: number;
  private defaultTTL: number;
  private aiService: ClaudeAIAnalysisService;
  private maxRetries: number = 3;
  private maxCacheSize: number = 100;
  private cacheMaintenanceInterval: number = 5 * 60 * 1000; // 5 minutes

  constructor(apiKey: string) {
    console.log('=== QueryService Constructor START ===', {
      timestamp: new Date().toISOString(),
      hasApiKey: !!apiKey
    });
    try {
      if (!apiKey) {
        console.warn('API key not provided to QueryService', {
          timestamp: new Date().toISOString()
        });
      }
      console.log('Initializing QueryService components...');
      this.cache = new Map();
      this.batchSize = 50;
      this.defaultTTL = 5 * 60 * 1000;
      this.aiService = new ClaudeAIAnalysisService(apiKey);
      this.setupCacheMaintenance();
      console.log('QueryService initialization complete', {
        timestamp: new Date().toISOString(),
        cacheSize: this.cache.size,
        batchSize: this.batchSize,
        ttl: this.defaultTTL
      });
    } catch (error) {
      console.error('Error in QueryService constructor:', {
        error,
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public static getInstance(apiKey?: string): QueryService {
    console.log('=== QueryService.getInstance START ===');
    try {
      if (!QueryService.instance) {
        console.log('Creating new QueryService instance...');
        // Try to get API key from environment if not provided
        const envApiKey = typeof window !== 'undefined' 
          ? process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY 
          : '';
        
        console.log('API Key status:', {
          providedKey: !!apiKey,
          envKey: !!envApiKey
        });
        
        QueryService.instance = new QueryService(apiKey || envApiKey || '');
      } else {
        console.log('Returning existing QueryService instance');
      }
      return QueryService.instance;
    } catch (error) {
      console.error('Error in getInstance:', error);
      throw error;
    }
  }

  private setupCacheMaintenance(): void {
    try {
      console.log('Setting up cache maintenance...');
      setInterval(() => {
        this.cleanCache();
      }, this.cacheMaintenanceInterval);
      console.log('Cache maintenance setup complete');
    } catch (error) {
      console.error('Error setting up cache maintenance:', error);
      throw error;
    }
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.expiresIn) {
        this.cache.delete(key);
      }
    }

    // If still over size limit, remove least accessed entries
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].metadata.accessCount - b[1].metadata.accessCount);
      
      while (this.cache.size > this.maxCacheSize) {
        const [key] = entries.shift() || [];
        if (key) this.cache.delete(key);
      }
    }
  }

  private async uploadOptimizedFeatureData(features: any[], query?: string, layerConfig?: any): Promise<string> {
    try {
      console.log('[QueryService] Starting feature data upload:', {
        featureCount: features.length,
        totalSize: JSON.stringify(features).length
      });

      // Import the optimization utility
      const { optimizeAnalysisFeatures } = await import('../feature-optimization');
      
      // Ensure we have a query and layerConfig
      const effectiveQuery = query || 'general-data-query';
      const effectiveLayerConfig = layerConfig || {
        id: 'default-layer',
        name: 'Default Layer',
        type: 'feature',
        rendererField: 'value'
      };
      
      // Always optimize feature data for analysis
      const optimizedData = await optimizeAnalysisFeatures(
        features,
        effectiveLayerConfig,
        {
          query: effectiveQuery,
          analysisType: 'query-service',
          additionalContext: {
            source: 'QueryService',
            timestamp: new Date().toISOString(),
            alwaysOptimized: true,
            performanceOptimized: true,
            skipSizeCheck: features.length < 1000 // Skip size check for small datasets
          }
        }
      );
      
      console.log('[QueryService] Optimized feature data:', {
        originalSize: JSON.stringify(features).length,
        optimizedSize: JSON.stringify(optimizedData).length,
        sizeReduction: `${((1 - JSON.stringify(optimizedData).length / JSON.stringify(features).length) * 100).toFixed(2)}%`
      });

      const blob = new Blob([JSON.stringify(optimizedData)], { type: 'application/json' });
      console.log('[QueryService] Created blob:', {
        size: blob.size,
        type: blob.type
      });

      const { url } = await upload(`features-${Date.now()}.json`, blob, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
      });

      console.log('[QueryService] Feature data uploaded successfully:', { url });
      return url;
    } catch (error) {
      console.error('[QueryService] Error uploading feature data:', {
        error,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async uploadQueryContext(query: string, config: QueryConfig): Promise<string> {
    const contextData = {
      query,
      config,
      timestamp: new Date().toISOString()
    };

    return this.uploadOptimizedFeatureData([contextData], query, config.layerConfig);
  }

  private async uploadQueryResults(results: FeatureSet, query?: string, layerConfig?: any): Promise<string> {
    const resultsData = {
      results,
      timestamp: new Date().toISOString()
    };

    return this.uploadOptimizedFeatureData([resultsData], query, layerConfig);
  }

  async executeQuery(config: QueryConfig): Promise<QueryResult> {
    const startTime = Date.now();
    console.log('[QueryService] Starting query execution:', {
      timestamp: new Date().toISOString(),
      sqlQuery: config.sqlQuery,
      layerUrl: config.layerConfig.url,
      layerName: config.layerConfig.name
    });

    const cacheKey = JSON.stringify(config);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.expiresIn) {
      console.log('[QueryService] Using cached result:', {
        timestamp: new Date().toISOString(),
        queryHash: cached.metadata.queryHash,
        featureCount: cached.result.featureSet.features?.length || 0,
        age: Date.now() - cached.timestamp,
        ttlRemaining: cached.expiresIn - (Date.now() - cached.timestamp)
      });
      cached.metadata.lastAccessed = Date.now();
      cached.metadata.accessCount++;
      return cached.result;
    }

    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        console.log(`[QueryService] Attempt ${attempt + 1} of ${this.maxRetries}`, {
          timestamp: new Date().toISOString(),
          attempt: attempt + 1,
          maxRetries: this.maxRetries
        });

        // Create query parameters
        const queryParams = new Query({
          where: config.sqlQuery,
          outFields: ["*"],
          returnGeometry: true
        });

        console.log('[QueryService] Executing query with params:', {
          timestamp: new Date().toISOString(),
          where: queryParams.where,
          outFields: queryParams.outFields,
          returnGeometry: queryParams.returnGeometry,
          url: config.layerConfig.url
        });

        // Execute the query to get features
        const featureSet = await query.executeQueryJSON(config.layerConfig.url, queryParams);
        
        const executionTime = Date.now() - startTime;
        console.log('[QueryService] Query executed successfully:', {
          timestamp: new Date().toISOString(),
          executionTimeMs: executionTime,
          featureCount: featureSet.features?.length || 0,
          hasGeometry: featureSet.features?.[0]?.geometry !== undefined,
          sampleAttributes: featureSet.features?.[0]?.attributes,
          layerUrl: config.layerConfig.url
        });

        // Cache and return the result
        const queryResult: QueryResult = { featureSet };
        this.cache.set(cacheKey, {
          result: queryResult,
          timestamp: Date.now(),
          expiresIn: this.defaultTTL,
          metadata: {
            queryHash: cacheKey,
            lastAccessed: Date.now(),
            accessCount: 1
          }
        });

        console.log('[QueryService] Result cached and returning', {
          timestamp: new Date().toISOString(),
          cacheSize: this.cache.size,
          executionTimeMs: Date.now() - startTime
        });
        return queryResult;
      } catch (error) {
        console.error(`[QueryService] Error in attempt ${attempt + 1}:`, {
          timestamp: new Date().toISOString(),
          error,
          message: error instanceof Error ? error.message : String(error),
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          layerUrl: config.layerConfig.url
        });
        
        attempt++;
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        const delay = 1000 * attempt;
        console.log(`[QueryService] Retrying in ${delay}ms...`, {
          timestamp: new Date().toISOString(),
          nextAttempt: attempt + 1,
          delay
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Failed to execute query after all retries');
  }

  async enhanceQuery(query: string, config: QueryConfig): Promise<any> {
    try {
      // Upload query context using client-side upload
      const contextUrl = await this.uploadQueryContext(query, config);

      // Use AI service to enhance query
      return await this.aiService.enhanceQuery(query, {
        contextUrl,
        layerConfig: config.layerConfig
      });
    } catch (error) {
      console.error('Query enhancement failed:', error);
      throw error;
    }
  }

  async analyzeBatch(queries: QueryConfig[]): Promise<FeatureSet[]> {
    const results: FeatureSet[] = [];
    
    for (let i = 0; i < queries.length; i += this.batchSize) {
      const batch = queries.slice(i, i + this.batchSize);
      const batchResults = await Promise.all(
        batch.map(config => this.executeQuery(config))
      );
      results.push(...batchResults.map(result => result.featureSet));
    }
    
    return results;
  }

  async analyzeQueryResults(query: string, featureSet: FeatureSet, config: QueryConfig): Promise<any> {
    try {
      // Upload results using the optimized upload method
      const resultsUrl = await this.uploadQueryResults(featureSet, query, config.layerConfig);
      
      // Use AI service to analyze the results
      return await this.aiService.analyze({
        prompt: query,
        features: featureSet.features as any,
        layerId: config.layerConfig.id,
        context: {
          resultsUrl,
          layerConfig: config.layerConfig
        }
      });
    } catch (error) {
      console.error('Results analysis failed:', error);
      throw error;
    }
  }
}

// Remove the immediate initialization
export const getQueryService = () => {
  console.log('=== getQueryService START ===');
  try {
    console.log('Getting API key...');
    const apiKey = typeof window !== 'undefined' 
      ? process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY 
      : '';
    console.log('API key status:', { hasKey: !!apiKey });
    
    console.log('Getting QueryService instance...');
    const instance = QueryService.getInstance(apiKey);
    console.log('QueryService instance obtained');
    return instance;
  } catch (error) {
    console.error('Error in getQueryService:', error);
    throw error;
  }
}; 